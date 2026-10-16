export function getAlbumCover(event, media) {
  const photos = media.filter(item => item.eventId === event.id && item.type?.startsWith('image/') && item.url);
  return photos.find(item => item.id === event.coverMediaId) ||
    photos.find(item => item.url === event.coverUrl) || photos[0] || null;
}
export function albumCoverUpdate(eventId, mediaId, media) {
  if (!mediaId) return { coverMediaId: null, coverUrl: null };
  const photo = media.find(item => item.id === mediaId && item.eventId === eventId && item.type?.startsWith('image/') && item.url);
  if (!photo) throw new Error('Escolha uma foto deste álbum para usar como capa.');
  return { coverMediaId: photo.id, coverUrl: photo.url };
}
