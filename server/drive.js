import { createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_FILE_SIZE = 512 * 1024 * 1024;
export const FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime']);
export const requiredKeys = ['GALLERY_ADMIN_PASSWORD', 'GALLERY_SESSION_SECRET'];
export function isConfigured(env = process.env) {
  const authReady = env.DRIVE_CONNECTOR_UID && env.DRIVE_SUBJECT_ID ||
    env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN;
  return Boolean(authReady) && requiredKeys.every(key => Boolean(env[key])) && env.GALLERY_SESSION_SECRET.length >= 32;
}
export const driveScopes = ['https://www.googleapis.com/auth/drive.file'];
export function connectParams() {
  if (!process.env.DRIVE_SUBJECT_ID) throw new Error('Proprietário do Drive não configurado.');
  return { subject: { type: 'user', id: process.env.DRIVE_SUBJECT_ID }, scopes: driveScopes };
}
export function sign(value, secret = process.env.GALLERY_SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new Error('Configuração de segurança incompleta.');
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function verify(token, secret = process.env.GALLERY_SESSION_SECRET) {
  try {
    const [body, signature, extra] = (token || '').split('.');
    if (extra || !body || !signature || !secret) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const value = JSON.parse(Buffer.from(body, 'base64url').toString());
    return value.exp > Date.now() ? value : null;
  } catch { return null; }
}
export function checkPassword(input, expected = process.env.GALLERY_ADMIN_PASSWORD) {
  if (!expected || typeof input !== 'string' || input.length > 256) return false;
  const hash = value => createHmac('sha256', 'cevic-password-comparison').update(value).digest();
  return timingSafeEqual(hash(input), hash(expected));
}
export function isAdmin(req) {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('cevic_admin='));
  return verify(cookie?.slice('cevic_admin='.length))?.role === 'admin';
}
export function sameOrigin(req) {
  const expected = process.env.GALLERY_ORIGIN || 'https://galeria-cevic.vercel.app';
  const deployment = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  return req.headers.origin === expected || Boolean(deployment && req.headers.origin === deployment);
}
export function assertFile(file) {
  if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 240 || !FILE_TYPES.has(file.type) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_FILE_SIZE) {
    throw new Error('Arquivo inválido. Use uma foto ou vídeo de até 512 MB.');
  }
}
// Coalesce concurrent requests; the Connect SDK already caches by token expiry.
let tokenRequest;
export function createRequestCache({ ttlMs = 60000, maxEntries = 300, now = Date.now } = {}) {
  const entries = new Map();
  return async (key, resolve) => {
    const cached = entries.get(key);
    if (cached && cached.expires > now()) return cached.promise;
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
    const entry = { expires: Infinity };
    entry.promise = Promise.resolve().then(resolve).then(value => {
      if (!value) { if (entries.get(key) === entry) entries.delete(key); }
      else entry.expires = now() + ttlMs;
      return value;
    }, error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
    entries.set(key, entry);
    return entry.promise;
  };
}
let cachedToken;
export async function getDriveToken(fetcher = fetch) {
  if (!tokenRequest) tokenRequest = requestDriveToken(fetcher).finally(() => { tokenRequest = null; });
  return tokenRequest;
}
async function requestDriveToken(fetcher) {
  if (process.env.DRIVE_CONNECTOR_UID) {
    const { getToken } = await import('@vercel/connect');
    return getToken(process.env.DRIVE_CONNECTOR_UID, connectParams());
  }
  if (cachedToken?.expires > Date.now() + 60000) return cachedToken.token;
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('A conexão da galeria com o Drive precisa ser autorizada novamente.');
  cachedToken = { token: result.access_token, expires: Date.now() + result.expires_in * 1000 };
  return cachedToken.token;
}
export async function driveFetch(path, options = {}) {
  const request = async () => fetch(`https://www.googleapis.com${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${await getDriveToken()}` } });
  let response = await request();
  if (response.status === 401) {
    await response.body?.cancel();
    cachedToken = null;
    if (process.env.DRIVE_CONNECTOR_UID) {
      const { deleteTokenCacheEntry } = await import('@vercel/connect');
      deleteTokenCacheEntry(process.env.DRIVE_CONNECTOR_UID, connectParams());
    }
    response = await request();
  }
  return response;
}
export function isThumbnailUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'));
  } catch { return false; }
}
export async function driveThumbnail(file) {
  if (!isThumbnailUrl(file.thumbnailLink)) return null;
  try {
    const response = await fetch(file.thumbnailLink, {
      headers: { Authorization: `Bearer ${await getDriveToken()}` }, redirect: 'error',
    });
    if (response.ok && /^image\/(jpeg|png|webp|gif)$/.test(response.headers.get('content-type')?.split(';')[0] || '')) return response;
    await response.body?.cancel();
  } catch { /* A missing/expired thumbnail falls back to the original. */ }
  return null;
}
let folderPromise;
export async function galleryFolder() {
  if (!folderPromise) folderPromise = resolveFolder().catch(error => { folderPromise = null; throw error; });
  return folderPromise;
}
async function resolveFolder() {
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    const response = await driveFetch(`/drive/v3/files/${process.env.GOOGLE_DRIVE_FOLDER_ID}?fields=id,mimeType,trashed`);
    if (response.ok) {
      const folder = await response.json();
      if (!folder.trashed && folder.mimeType === 'application/vnd.google-apps.folder') return folder.id;
    } else if (response.status !== 404 && response.status !== 403) {
      throw new Error('Não foi possível verificar a pasta da galeria.');
    }
  }
  // drive.file grants access only to this application's files. Reuse its own
  // dedicated folder if the connector-created folder is not visible to this client.
  const query = encodeURIComponent("trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='cevicRoot' and value='galeria-cevic' }");
  const listed = await driveFetch(`/drive/v3/files?q=${query}&fields=files(id)&pageSize=1`);
  if (!listed.ok) throw new Error('Não foi possível localizar a pasta da galeria.');
  const result = await listed.json();
  if (result.files?.[0]) return result.files[0].id;
  const created = await driveFetch('/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Galeria CEVIC — Uploads do aplicativo', mimeType: 'application/vnd.google-apps.folder', appProperties: { cevicRoot: 'galeria-cevic' } }),
  });
  const folder = await created.json();
  if (!created.ok || !folder.id) throw new Error('Não foi possível criar a pasta exclusiva da galeria.');
  return folder.id;
}
const cachedFile = createRequestCache();
export async function getGalleryFile(id) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id || '')) return null;
  return cachedFile(id, async () => {
    const response = await driveFetch(`/drive/v3/files/${id}?fields=id,name,mimeType,size,modifiedTime,thumbnailLink,parents,appProperties,trashed`);
    if (!response.ok) return null;
    const file = await response.json();
    return !file.trashed && file.parents?.includes(await galleryFolder()) && file.appProperties?.cevicGallery === 'true' && FILE_TYPES.has(file.mimeType) ? file : null;
  });
}
export function jsonError(res, status, message) { return res.status(status).json({ error: message }); }
