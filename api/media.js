import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getGalleryFile, driveFetch, jsonError } from '../server/drive.js';
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  try {
    const file = await getGalleryFile(req.query.id);
    if (!file) return jsonError(res, 404, 'Arquivo não encontrado nesta galeria.');
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const response = await driveFetch(`/drive/v3/files/${file.id}?alt=media`, { method: 'GET', headers });
    if (!response.ok) return jsonError(res, response.status, 'Não foi possível carregar este arquivo.');
    res.status(response.status);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.setHeader('Accept-Ranges', 'bytes');
    if (response.headers.has('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'));
    if (req.method === 'HEAD') { await response.body?.cancel(); return res.end(); }
    await pipeline(Readable.fromWeb(response.body), res);
  } catch {
    if (!res.headersSent) return jsonError(res, 503, 'O armazenamento está indisponível. Tente novamente.');
    res.end();
  }
}
