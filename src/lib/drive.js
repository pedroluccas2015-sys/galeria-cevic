async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Falha na conexão com o Drive.');
  return data;
}
export async function uploadToDrive(file, onProgress = () => {}, fetcher = fetch) {
  const session = await readResponse(await fetcher('/api/drive-upload', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { name: file.name, type: file.type, size: file.size } }),
  }));
  // Upload directly to Drive in 8 MiB chunks, avoiding the Vercel function body limit.
  const chunkSize = 8 * 1024 * 1024;
  let offset = 0;
  let fileId;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const response = await fetcher(session.uploadUrl, {
      method: 'PUT', headers: { 'Content-Type': file.type, 'Content-Range': `bytes ${offset}-${end - 1}/${file.size}` },
      body: file.slice(offset, end),
    });
    if (response.status === 308) {
      const range = response.headers.get('Range');
      const match = range?.match(/^bytes=0-(\d+)$/);
      const confirmed = match ? Number(match[1]) + 1 : 0;
      if (confirmed <= offset || confirmed > end) throw new Error('O Drive não confirmou o progresso. Tente enviar novamente.');
      offset = confirmed;
    } else {
      const result = await readResponse(response);
      if (!result.id) throw new Error('O Drive não confirmou o arquivo enviado.');
      fileId = result.id;
      offset = file.size;
    }
    onProgress(Math.round(offset / file.size * 100));
  }
  if (!fileId) throw new Error('O envio ainda não foi concluído. Tente novamente.');
  return readResponse(await fetcher('/api/drive-upload', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', fileId, receipt: session.receipt }),
  }));
}
