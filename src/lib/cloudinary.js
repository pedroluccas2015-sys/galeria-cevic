export async function uploadMedia(file, cloudName, preset, fetcher = fetch) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`, {
    method: 'POST', body: formData,
  });
  const data = await response.json();
  if (!response.ok || !data.secure_url?.startsWith('https://')) {
    throw new Error(data.error?.message || 'O servidor de mídia não confirmou o envio.');
  }
  return data.secure_url;
}
