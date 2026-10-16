import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getGalleryFile, driveFetch, driveThumbnail, jsonError } from '../server/drive.js';
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');
  try {
    const file = await getGalleryFile(req.query.id);
    if (!file) return jsonError(res, 404, 'Arquivo não encontrado nesta galeria.');
    const thumbnail = req.query.preview === '1' && file.mimeType.startsWith('image/');
    const etag = `W/"${file.id}-${file.size}-${(file.modifiedTime || '').replace(/[^a-zA-Z0-9]/g, '')}-${thumbnail ? 'preview' : 'original'}"`;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers['if-none-match'] === etag && !req.headers.range) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-if-error=86400');
      return res.status(304).end();
    }
    const headers = {};
    if (req.headers.range && !thumbnail) headers.Range = req.headers.range;
    const response = (thumbnail && await driveThumbnail(file)) || await driveFetch(`/drive/v3/files/${file.id}?alt=media`, { method: 'GET', headers });
    if (!response.ok) return jsonError(res, response.status, 'Não foi possível carregar este arquivo.');
    res.status(response.status);
    res.setHeader('Content-Type', thumbnail ? response.headers.get('content-type') || file.mimeType : file.mimeType);
    // The same public file URL can be reused without another function/Drive call.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-if-error=86400');
    res.setHeader('ETag', etag);
    if (!thumbnail) res.setHeader('Accept-Ranges', 'bytes');
    if (response.headers.has('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'));
    if (response.headers.has('content-length')) res.setHeader('Content-Length', response.headers.get('content-length'));
    if (req.method === 'HEAD') { await response.body?.cancel(); return res.end(); }
    await pipeline(Readable.fromWeb(response.body), res);
  } catch {
    if (!res.headersSent) { res.setHeader('Cache-Control', 'no-store'); return jsonError(res, 503, 'O armazenamento está indisponível. Tente novamente.'); }
    res.end();
  }
}
