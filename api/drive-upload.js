import { isConfigured, isAdmin, sameOrigin, assertFile, driveFetch, sign, verify, getGalleryFile, galleryFolder, jsonError } from '../server/drive.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req) || !isAdmin(req)) return jsonError(res, 401, 'Entre novamente na área de mídia.');
  if (!isConfigured()) return jsonError(res, 503, 'O Google Drive ainda não foi configurado.');
  try {
    if (req.body?.action === 'complete') {
      const receipt = verify(req.body.receipt);
      const file = await getGalleryFile(req.body.fileId);
      if (!receipt || receipt.kind !== 'upload' || !file || file.id !== receipt.fileId || Number(file.size) !== receipt.size || file.mimeType !== receipt.type) return jsonError(res, 400, 'O Drive não confirmou o arquivo completo.');
      return res.json({ fileId: file.id, url: `/api/media?id=${file.id}`, name: file.name, type: file.mimeType, provider: 'google-drive' });
    }
    const file = req.body?.file;
    assertFile(file);
    // Generate an ID before upload so the completion receipt is bound to exactly one file.
    const idsResponse = await driveFetch('/drive/v3/files/generateIds?count=1&space=drive');
    const ids = await idsResponse.json();
    if (!idsResponse.ok || !ids.ids?.[0]) {
      const reason = ids.error?.errors?.[0]?.reason || ids.error?.status || 'unknown';
      throw new Error(`Não foi possível reservar o arquivo no Drive (HTTP ${idsResponse.status}; ${reason}). ${ids.error?.message || ''}`);
    }
    const fileId = ids.ids[0];
    const response = await driveFetch('/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'POST',
      headers: { Origin: req.headers.origin, 'Content-Type': 'application/json', 'X-Upload-Content-Type': file.type, 'X-Upload-Content-Length': String(file.size) },
      body: JSON.stringify({ id: fileId, name: file.name, mimeType: file.type, parents: [await galleryFolder()], appProperties: { cevicGallery: 'true' } }),
    });
    const uploadUrl = response.headers.get('location');
    if (!response.ok || !uploadUrl || new URL(uploadUrl).origin !== 'https://www.googleapis.com') throw new Error('Não foi possível iniciar o envio ao Drive.');
    return res.json({ uploadUrl, receipt: sign({ kind: 'upload', fileId, size: file.size, type: file.type, exp: Date.now() + 24 * 60 * 60 * 1000 }) });
  } catch (error) { return jsonError(res, 502, error.message); }
}
