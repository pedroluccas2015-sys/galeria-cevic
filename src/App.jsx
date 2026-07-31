import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Video, Upload, Share2, Lock, X, ChevronLeft, ChevronRight, Plus, Image as ImageIcon, Play, CheckCircle, Trash2 } from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

// Inicialização do Firebase (Apenas Auth e Firestore)
let app, auth, db;
const appId = 'galeria-cevic-app';
const dummyKey = "SUA_API_KEY_AQUI";
let isDemoMode = true;

// Variáveis do Cloudinary
let cloudinaryCloudName = "";
let cloudinaryPreset = "";

try {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || dummyKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "galeria-cevic.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "galeria-cevic",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "galeria-cevic.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "832876748713",
    appId: env.VITE_FIREBASE_APP_ID || "1:832876748713:web:e8e57b26540c64eb3d6eb8"
  };

  // Carrega as chaves do Cloudinary
  cloudinaryCloudName = env.VITE_CLOUDINARY_CLOUD_NAME || "xxcqfgis";
  cloudinaryPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET || "cevic_preset";
  
  isDemoMode = firebaseConfig.apiKey === dummyKey;

  if (!isDemoMode) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Fallback para teste local
const simulateLocalUpload = (file) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    setTimeout(() => resolve(url), 1500);
  });
};

const Button = ({ children, onClick, className = "", type = "button", disabled = false }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`bg-blue-600 text-white px-4 py-2 rounded-md font-medium transition-all duration-200 hover:bg-blue-700 active:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
  >
    {children}
  </button>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [media, setMedia] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  // Logo da Igreja
  const logoSrc = "/logo.jpg";

  const loadLocalData = useCallback(() => {
    setEvents(JSON.parse(localStorage.getItem('cevic_events') || '[]'));
    setMedia(JSON.parse(localStorage.getItem('cevic_media') || '[]'));
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setUser({ uid: 'demo-user', isAnonymous: true });
      return;
    }
    if (!auth) return;
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.warn(err.message); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      loadLocalData();
      window.addEventListener('localDataChanged', loadLocalData);
      return () => window.removeEventListener('localDataChanged', loadLocalData);
    }
    if (!user || !db) return;
    
    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      eventsData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setEvents(eventsData);
    });

    const mediaRef = collection(db, 'artifacts', appId, 'public', 'data', 'media');
    const unsubMedia = onSnapshot(mediaRef, (snapshot) => {
      const mediaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mediaData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setMedia(mediaData);
    });

    return () => { unsubEvents(); unsubMedia(); };
  }, [user]);

  useEffect(() => {
    if (events.length > 0 && initialLoad) {
      const params = new URLSearchParams(window.location.search);
      const eventId = params.get('event');
      if (eventId) {
        const sharedEvent = events.find(e => e.id === eventId);
        if (sharedEvent) {
          setSelectedEvent(sharedEvent);
          setCurrentView('event');
        }
      }
      setInitialLoad(false);
    }
  }, [events, initialLoad]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const navigateTo = (view, event = null) => {
    setCurrentView(view);
    setSelectedEvent(event);
    try {
      if (event) {
        window.history.pushState({}, '', `?event=${event.id}`);
      } else {
        window.history.pushState({}, '', window.location.pathname);
      }
    } catch (err) {}
    window.scrollTo(0, 0);
  };

  const shareLink = (eventId) => {
    const url = window.location.href.split('?')[0] + `?event=${eventId}`;
    const fallbackCopy = (text) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showToast("Link copiado para compartilhar!");
      } catch (err) {}
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => showToast("Link copiado para compartilhar!")).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans selection:bg-blue-600 selection:text-white">
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigateTo('home')}>
            <img 
              src={logoSrc} 
              alt="GALERIA CEVIC" 
              className="h-14 w-14 object-contain p-1 rounded-full border-2 border-zinc-800 group-hover:border-blue-500 transition-colors bg-black"
              onError={(e) => {
                e.target.onerror = null; 
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMyMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPkM8L3RleHQ+PC9zdmc+';
              }}
            />
            <h1 className="text-2xl font-bold tracking-widest uppercase">GALERIA CEVIC</h1>
          </div>
          
          <nav className="flex gap-3">
            <Button className={currentView === 'home' ? 'bg-blue-700' : 'bg-transparent text-zinc-300 hover:bg-zinc-800'} onClick={() => navigateTo('home')}>
              Eventos
            </Button>
            <Button className={currentView === 'admin' ? 'bg-blue-700' : 'bg-transparent text-zinc-300 hover:bg-zinc-800'} onClick={() => navigateTo('admin')}>
              <Upload size={18} /> <span className="hidden sm:inline">Administrar</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8">
        {currentView === 'home' && <HomeView events={events} media={media} onEventClick={(evt) => navigateTo('event', evt)} />}
        {currentView === 'event' && selectedEvent && <EventView event={selectedEvent} media={media.filter(m => m.eventId === selectedEvent.id)} onBack={() => navigateTo('home')} onShare={() => shareLink(selectedEvent.id)} />}
        {currentView === 'admin' && <AdminView events={events} media={media} user={user} db={db} appId={appId} isDemoMode={isDemoMode} />}
      </main>

      {/* Rodapé com as informações da Igreja */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-10 mt-auto text-center text-zinc-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center justify-center space-y-4">
          <p className="text-xs sm:text-sm md:text-base font-medium tracking-wider leading-relaxed">
            CULTOS DE ESTUDO: TERÇA-FEIRA 19H30 <span className="hidden sm:inline mx-2">|</span><br className="sm:hidden" /> 
            CULTO DE ORAÇÃO: QUINTA-FEIRA 19H30 <span className="hidden sm:inline mx-2">|</span><br className="sm:hidden" /> 
            CULTO DE ADORAÇÃO: DOMINGO 19H00.
          </p>
          <div className="h-px w-24 bg-zinc-800 my-2"></div>
          <p className="text-sm sm:text-base md:text-lg font-bold text-white tracking-widest uppercase">
            CEVIC, QUEM GOSTA VEM, QUEM AMA FICA!
          </p>
        </div>
      </footer>

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <CheckCircle size={20} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function HomeView({ events, media, onEventClick }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <h2 className="text-3xl font-semibold">Nossos Eventos</h2>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-xl">Nenhum evento criado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {events.map(event => {
            const eventMedia = media.filter(m => m.eventId === event.id);
            const coverMedia = eventMedia.length > 0 ? eventMedia[0].url : null;
            const isVideoCover = eventMedia.length > 0 && eventMedia[0].type.startsWith('video');

            return (
              <div key={event.id} className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-blue-500 transition-colors cursor-pointer shadow-lg" onClick={() => onEventClick(event)}>
                <div className="aspect-[4/3] bg-zinc-800 relative overflow-hidden flex items-center justify-center">
                  {coverMedia ? (
                     isVideoCover ? <video src={coverMedia} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-500" /> : <img src={coverMedia} alt={event.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all group-hover:scale-105 duration-500" loading="lazy" />
                  ) : <ImageIcon size={48} className="text-zinc-700" />}
                  {eventMedia.length > 0 && <div className="absolute top-3 right-3 bg-blue-600 text-xs font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">{eventMedia.length} {eventMedia.length === 1 ? 'item' : 'itens'}</div>}
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-bold truncate group-hover:text-blue-400 transition-colors">{event.name}</h3>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventView({ event, media, onBack, onShare }) {
  const [lightboxItem, setLightboxItem] = useState(null);
  const currentIndex = lightboxItem ? media.findIndex(m => m.id === lightboxItem.id) : -1;

  const goNext = (e) => { e.stopPropagation(); if (currentIndex < media.length - 1) setLightboxItem(media[currentIndex + 1]); };
  const goPrev = (e) => { e.stopPropagation(); if (currentIndex > 0) setLightboxItem(media[currentIndex - 1]); };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!lightboxItem) return;
      if (e.key === 'ArrowRight') goNext(e);
      if (e.key === 'ArrowLeft') goPrev(e);
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem, currentIndex]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} className="bg-zinc-800 hover:bg-zinc-700 px-3"><ChevronLeft size={20} /></Button>
          <div>
            <h2 className="text-2xl font-semibold">{event.name}</h2>
            <p className="text-zinc-400 text-sm">{media.length} {media.length === 1 ? 'item' : 'itens'}</p>
          </div>
        </div>
        <Button onClick={onShare} className="bg-zinc-800 hover:bg-zinc-700"><Share2 size={16} /> Compartilhar Álbum</Button>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-xl">Nenhuma foto adicionada.</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {media.map((item) => (
            <div key={item.id} className="break-inside-avoid cursor-pointer group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-blue-500 bg-zinc-900 shadow-md" onClick={() => setLightboxItem(item)}>
              {item.type.startsWith('video') ? (
                <div className="relative">
                  <video src={item.url} className="w-full object-cover" />
                  <Play size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 group-hover:scale-110 group-hover:text-white transition-all drop-shadow-lg" />
                </div>
              ) : <img src={item.url} alt="Galeria" className="w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />}
            </div>
          ))}
        </div>
      )}

      {lightboxItem && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 sm:p-8 backdrop-blur-md" onClick={() => setLightboxItem(null)}>
          <button className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 bg-zinc-900/50 rounded-full z-50 transition-colors"><X size={28} /></button>
          {currentIndex > 0 && <button onClick={goPrev} className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white p-2 bg-zinc-800/80 hover:bg-blue-600 rounded-full z-50 transition-colors"><ChevronLeft size={32} /></button>}
          <div className="max-w-5xl relative flex justify-center w-full" onClick={e => e.stopPropagation()}>
            {lightboxItem.type.startsWith('video') ? <video src={lightboxItem.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-md shadow-2xl" /> : <img src={lightboxItem.url} alt="Full" className="max-h-[85vh] max-w-full object-contain rounded-md shadow-2xl" />}
          </div>
          {currentIndex < media.length - 1 && <button onClick={goNext} className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white p-2 bg-zinc-800/80 hover:bg-blue-600 rounded-full z-50 transition-colors"><ChevronRight size={32} /></button>}
        </div>
      )}
    </div>
  );
}

function AdminView({ events, media, user, db, appId, isDemoMode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "cevic") setIsAuthenticated(true);
    else { setLoginError("Senha incorreta."); setPassword(''); }
  };

  if (!isAuthenticated) return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
      <div className="text-center mb-8">
        <Lock size={32} className="mx-auto text-blue-500 mb-4" />
        <h2 className="text-2xl font-bold">Área Restrita</h2>
      </div>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de acesso..." className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
        {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
        <Button type="submit" className="w-full py-3">Acessar</Button>
      </form>
    </div>
  );

  return <UploadManager events={events} media={media} user={user} db={db} appId={appId} isDemoMode={isDemoMode} />;
}

function UploadManager({ events, media, user, db, appId, isDemoMode }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [modalConfig, setModalConfig] = useState(null);
  const fileInputRef = useRef(null);

  const eventMedia = selectedEventId ? media.filter(m => m.eventId === selectedEventId) : [];
  const triggerLocalUpdate = () => window.dispatchEvent(new Event('localDataChanged'));
  const showAlert = (message) => setModalConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setModalConfig({ type: 'confirm', message, onConfirm });

  const handleFileSelect = (e) => {
    const validFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const espacoRestante = 300 - (eventMedia.length + files.length);
    if (espacoRestante <= 0) return showAlert("O limite de 300 arquivos por evento foi atingido!");
    
    let arquivosParaAdicionar = validFiles;
    if (validFiles.length > espacoRestante) {
      showAlert(`Limite excedido. Apenas os ${espacoRestante} primeiros arquivos foram adicionados.`);
      arquivosParaAdicionar = validFiles.slice(0, espacoRestante);
    }
    
    setFiles(prev => [...prev, ...arquivosParaAdicionar]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;
    if (isDemoMode) {
      const newEvent = { id: Date.now().toString(), name: newEventName.trim(), createdAt: Date.now() };
      localStorage.setItem('cevic_events', JSON.stringify([newEvent, ...JSON.parse(localStorage.getItem('cevic_events') || '[]')]));
      triggerLocalUpdate(); setSelectedEventId(newEvent.id); setIsCreatingEvent(false); setNewEventName('');
      return;
    }
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), { name: newEventName.trim(), createdAt: serverTimestamp() });
    setSelectedEventId(docRef.id); setIsCreatingEvent(false); setNewEventName('');
  };

  const handleDeleteMedia = (mediaId) => {
    showConfirm("Tem certeza que deseja excluir esta foto/vídeo?", async () => {
      if (isDemoMode) {
        localStorage.setItem('cevic_media', JSON.stringify(JSON.parse(localStorage.getItem('cevic_media')||'[]').filter(m => m.id !== mediaId)));
        triggerLocalUpdate();
      } else {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'media', mediaId));
      }
    });
  };

  const handleDeleteEvent = () => {
    showConfirm("Excluir este evento e TODOS os seus arquivos? Esta ação não tem volta.", async () => {
      if (isDemoMode) {
        localStorage.setItem('cevic_events', JSON.stringify(JSON.parse(localStorage.getItem('cevic_events')||'[]').filter(e => e.id !== selectedEventId)));
        localStorage.setItem('cevic_media', JSON.stringify(JSON.parse(localStorage.getItem('cevic_media')||'[]').filter(m => m.eventId !== selectedEventId)));
        triggerLocalUpdate(); setSelectedEventId('');
      } else {
        for (const m of eventMedia) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'media', m.id));
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', selectedEventId));
        setSelectedEventId('');
      }
    });
  };

  const startUpload = async () => {
    if (!cloudinaryCloudName || !cloudinaryPreset) {
       return showAlert("Faltam as chaves do Cloudinary! Configure as chaves VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET.");
    }

    setUploading(true); setUploadProgress(0);
    let completed = 0;
    
    for (const file of files) {
      try {
        let downloadUrl = "";

        if (!isDemoMode) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', cloudinaryPreset);

          const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
          const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/${resourceType}/upload`;

          const response = await fetch(uploadUrl, { method: 'POST', body: formData });
          if (!response.ok) throw new Error("Erro no upload");
          
          const data = await response.json();
          downloadUrl = data.secure_url; 
        } else {
           downloadUrl = await simulateLocalUpload(file);
        }

        if (isDemoMode) {
          localStorage.setItem('cevic_media', JSON.stringify([...JSON.parse(localStorage.getItem('cevic_media')||'[]'), { id: Date.now().toString()+Math.random(), eventId: selectedEventId, url: downloadUrl, type: file.type, name: file.name, createdAt: Date.now() }]));
          triggerLocalUpdate();
        } else {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'media'), { eventId: selectedEventId, url: downloadUrl, type: file.type, name: file.name, createdAt: serverTimestamp() });
        }
      } catch (err) {
         console.error("Erro no upload do arquivo:", err);
      }
      completed++; setUploadProgress(Math.round((completed / files.length) * 100));
    }
    setUploading(false); setFiles([]); showAlert("Upload concluído com sucesso!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-xl shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400"><Upload size={20} /> Gerenciar Eventos</h2>
          {selectedEventId && !isCreatingEvent && <Button onClick={handleDeleteEvent} className="bg-transparent border border-red-900 text-red-500 hover:bg-red-900/40 hover:text-red-400 text-sm"><Trash2 size={16} /> Excluir Evento</Button>}
        </div>

        <div className="mb-8 p-4 md:p-6 bg-black border border-zinc-800 rounded-lg">
          <h3 className="text-sm font-semibold mb-3 text-zinc-400">1. Selecione o Evento</h3>
          {!isCreatingEvent ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500">
                <option value="" disabled>-- Escolha um evento --</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              <Button onClick={() => setIsCreatingEvent(true)} className="bg-zinc-800 hover:bg-zinc-700"><Plus size={16} /> Novo Evento</Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <input type="text" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="Ex: Culto de Jovens..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500" autoFocus />
              <div className="flex gap-2">
                <Button onClick={handleCreateEvent} className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none">Criar</Button>
                <Button onClick={() => setIsCreatingEvent(false)} className="bg-zinc-700 hover:bg-zinc-600 flex-1 sm:flex-none">Cancelar</Button>
              </div>
            </div>
          )}
        </div>

        {selectedEventId && !isCreatingEvent && (
          <div className="mb-8 p-4 md:p-6 bg-black border border-zinc-800 rounded-lg">
            <h3 className="text-sm font-semibold mb-3 text-zinc-400">2. Arquivos Existentes ({eventMedia.length}/300)</h3>
            
            {eventMedia.length === 0 ? (
               <p className="text-zinc-500 text-sm italic">Nenhum arquivo neste evento. Faça o upload abaixo.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {eventMedia.map((m) => (
                  <div key={m.id} className="relative group bg-zinc-800 rounded-md aspect-square flex items-center justify-center overflow-hidden border border-zinc-700">
                    {m.type.startsWith('video') ? <div className="w-full h-full relative"><video src={m.url} className="w-full h-full object-cover opacity-60" /><Play size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" /></div> : <img src={m.url} className="w-full h-full object-cover" />}
                    <button onClick={() => handleDeleteMedia(m.id)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 hover:bg-red-700 hover:scale-110 shadow-lg transition-all"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`mb-8 p-6 border-2 border-dashed rounded-xl text-center transition-colors ${selectedEventId ? 'border-zinc-600 hover:border-blue-500 bg-black/50' : 'border-zinc-800 bg-black/20 pointer-events-none opacity-50'}`}>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,video/*" />
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4 text-zinc-500"><Camera size={36} /><Video size={36} /></div>
            
            {eventMedia.length + files.length >= 300 ? (
              <p className="text-red-500 font-bold">Capacidade máxima atingida (300/300)</p>
            ) : (
              <Button onClick={() => fileInputRef.current?.click()}>Escolher Novos Arquivos</Button>
            )}
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-4 p-4 md:p-6 bg-black border border-zinc-800 rounded-lg">
            <h3 className="text-sm font-semibold text-zinc-400 border-b border-zinc-800 pb-2">3. Novos Arquivos ({files.length})</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {files.map((file, idx) => (
                <div key={idx} className="relative group bg-zinc-800 rounded-lg aspect-square flex items-center justify-center overflow-hidden border border-zinc-700">
                  {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" /> : <div className="text-center p-2"><Video size={24} className="mx-auto text-zinc-500 mb-1" /><span className="text-[10px] text-zinc-400 break-all">{file.name}</span></div>}
                  {!uploading && <button onClick={() => removeFile(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600"><X size={14} /></button>}
                </div>
              ))}
            </div>

            {uploading ? (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl mt-4">
                 <div className="flex justify-between text-sm mb-2 font-medium"><span className="text-blue-400">Enviando arquivos...</span><span>{uploadProgress}%</span></div>
                 <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div></div>
              </div>
            ) : <Button onClick={startUpload} className="w-full bg-blue-600 hover:bg-blue-700 py-3 mt-4 text-lg"><Upload size={18} /> Iniciar Upload para Galeria</Button>}
          </div>
        )}

        {modalConfig && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-3 text-white">{modalConfig.type === 'confirm' ? 'Atenção' : 'Aviso'}</h3>
              <p className="text-zinc-300 mb-6">{modalConfig.message}</p>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setModalConfig(null)} className={modalConfig.type === 'confirm' ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-blue-600 hover:bg-blue-700'}>{modalConfig.type === 'confirm' ? 'Cancelar' : 'OK'}</Button>
                {modalConfig.type === 'confirm' && <Button onClick={() => { modalConfig.onConfirm(); setModalConfig(null); }} className="bg-red-600 hover:bg-red-700">Confirmar</Button>}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #18181b; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}} />
    </div>
  );
}