import { isAdmin, sameOrigin, connectParams, isConfigured, jsonError } from '../server/drive.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req) || !isAdmin(req)) return jsonError(res, 401, 'Entre na área de mídia para autorizar o armazenamento.');
  if (!isConfigured() || !process.env.DRIVE_CONNECTOR_UID) return jsonError(res, 503, 'A conexão Google ainda não foi configurada.');
  try {
    const { startAuthorization } = await import('@vercel/connect');
    const result = await startAuthorization(process.env.DRIVE_CONNECTOR_UID, connectParams(), {
      callbackUrl: `${req.headers.origin}/?drive=connected`,
    });
    const url = new URL(result.url);
    if (url.protocol !== 'https:') throw new Error('Endereço de autorização inválido.');
    return res.json({ url: result.url });
  } catch { return jsonError(res, 502, 'Não foi possível iniciar a autorização Google.'); }
}
