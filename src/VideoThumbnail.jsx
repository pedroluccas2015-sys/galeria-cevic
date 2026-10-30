import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

export default function VideoThumbnail({ item }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [firstFrame, setFirstFrame] = useState('');
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  // Old videos without a stored poster show their first decoded frame on demand.
  return <div ref={container} className="relative w-full h-full bg-zinc-900">
    {(firstFrame || (item.thumbnailUrl && !posterFailed))
      ? <img src={firstFrame || item.thumbnailUrl} alt={`Prévia de ${item.name || 'vídeo'}`} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setPosterFailed(true)} />
      : visible && <video src={item.url} preload="auto" muted playsInline onLoadedData={event => {
        const video = event.currentTarget;
        video.pause();
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          setFirstFrame(canvas.toDataURL('image/jpeg', 0.82));
          video.removeAttribute('src');
          video.load();
        } catch { video.preload = 'none'; }
      }} aria-label={`Prévia de ${item.name || 'vídeo'}`} className="w-full h-full object-cover" />}
    <Play size={32} aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow-md pointer-events-none" />
  </div>;
}
