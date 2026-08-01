import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, Video, Lock, X, ChevronLeft, ChevronRight, 
  Image as ImageIcon, Play, CheckCircle, Trash2, MapPin, 
  Radio, Upload, Plus, Share2
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';

let app, auth, db;
let appId = 'galeria-cevic-app';
let isDemoMode = true;

// Tenta carregar as variáveis de ambiente do Vite (Localhost)
let env = {};
try {
  env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
} catch (e) {}

// Configurações do Cloudinary (Restauradas)
const CLOUDINARY_CLOUD_NAME = env.VITE_CLOUDINARY_CLOUD_NAME || "xxcqfgis";
const CLOUDINARY_UPLOAD_PRESET = env.VITE_CLOUDINARY_UPLOAD_PRESET || "cevic_preset";

try {
  let firebaseConfig;

  // Verifica se estamos no ambiente interativo (Canvas) ou Localhost
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'galeria-cevic-app';
    isDemoMode = false;
  } else {
    // Estamos no Localhost - Usa as chaves do seu projeto Galeria CEVIC
    const apiKey = env.VITE_FIREBASE_API_KEY || "COLOQUE_SUA_API_KEY_AQUI";
    firebaseConfig = {
      apiKey: apiKey,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "galeria-cevic.firebaseapp.com",
      projectId: env.VITE_FIREBASE_PROJECT_ID || "galeria-cevic",
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "galeria-cevic.firebasestorage.app",
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "832876748713",
      appId: env.VITE_FIREBASE_APP_ID || "1:832876748713:web:e8e57b26540c64eb3d6eb8"
    };
    
    // Se a API Key for o placeholder, entra em modo Demo localmente (localStorage)
    isDemoMode = apiKey === "COLOQUE_SUA_API_KEY_AQUI";
  }

  if (!isDemoMode) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Erro na inicialização do Firebase:", error);
  isDemoMode = true; // Fallback seguro
}

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
    className={`px-4 py-2 rounded-md font-bold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
  >
    {children}
  </button>
);

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #000000; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #333333; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555555; }
    
    /* Estilo 3D inspirado no Canva */
    .text-3d-canva { 
      text-shadow: 2px 2px 0 #004aad, 4px 4px 0 #004aad, 6px 6px 0 #002255; 
      color: white; 
      font-style: italic;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    
    body { background-color: black; margin: 0; padding: 0; color: white; font-family: sans-serif; }
  `}} />
);

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('home'); 
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [media, setMedia] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  // Logo da igreja
  const logoSrc = "logo.jpg";

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
      try { 
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth); 
        }
      } catch (err) { console.warn("Aviso Auth:", err.message); }
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
  }, [user, loadLocalData]);

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
      if (event) window.history.pushState({}, '', `?event=${event.id}`);
      else window.history.pushState({}, '', window.location.pathname);
    } catch (err) {}
    window.scrollTo(0, 0);
  };

  const shareLink = (eventId) => {
    const url = window.location.origin + window.location.pathname + `?event=${eventId}`;
    
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
      } catch (err) {
        console.error("Erro ao copiar: ", err);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => showToast("Link copiado para compartilhar!"))
        .catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center overflow-x-hidden selection:bg-[#004aad] selection:text-white">
      <GlobalStyles />
      
      {/* Header Botão Admin */}
      <header className="w-full fixed top-0 z-40 p-4 flex justify-end pointer-events-none">
         <div className="pointer-events-auto">
            <Button 
              className="bg-black/50 border border-zinc-800 backdrop-blur-md text-zinc-400 hover:text-white hover:border-[#004aad] rounded-full px-4 text-xs"
              onClick={() => navigateTo(currentView === 'admin' ? 'home' : 'admin')}
            >
              {currentView === 'admin' ? 'Voltar' : <><Lock size={14}/> Acesso da Mídia</>}
            </Button>
         </div>
      </header>

      <main className="flex-grow w-full max-w-md md:max-w-3xl mx-auto px-4 sm:px-6 py-12 pt-20">
        {currentView === 'home' && (
          <HomeView events={events} media={media} onEventClick={(evt) => navigateTo('event', evt)} logoSrc={logoSrc} />
        )}
        {currentView === 'event' && selectedEvent && (
          <EventView event={selectedEvent} media={media.filter(m => m.eventId === selectedEvent.id)} onBack={() => navigateTo('home')} onShare={() => shareLink(selectedEvent.id)} />
        )}
        {currentView === 'admin' && (
          <AdminView events={events} media={media} user={user} db={db} appId={appId} isDemoMode={isDemoMode} />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#004aad] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-50 font-bold whitespace-nowrap">
          <CheckCircle size={20} />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function HomeView({ events, media, onEventClick, logoSrc }) {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-16">
      
      {/* CABEÇALHO - Apenas logo centralizada e Título 3D */}
      <div className="flex flex-col items-center justify-center space-y-6 pt-4 mb-16">
        <div className="flex justify-center">
            <div className="h-28 w-28 md:h-32 md:w-32 rounded-full flex items-center justify-center overflow-hidden p-1 shadow-2xl bg-black border border-zinc-800">
              <img 
                src={logoSrc} 
                alt="Logo CEVIC" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.onerror = null; 
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMyMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPkM8L3RleHQ+PC9zdmc+';
                }}
              />
            </div>
        </div>
        
        <h1 className="text-4xl md:text-6xl text-center text-3d-canva">
          Galeria CEVIC
        </h1>
      </div>

      {/* ARQUIVOS DE MÍDIA - Grade Quadrada minimalista */}
      <div className="pt-8">
        <div className="flex justify-between items-end mb-8 border-b border-zinc-800 pb-4 px-2">
          <h2 className="text-3xl font-black italic uppercase leading-none">Nossos<br/>Eventos</h2>
          <p className="text-[10px] sm:text-xs font-bold uppercase text-right max-w-[150px] leading-tight text-zinc-300">Clique nas imagens para abrir o álbum daquela data !</p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 font-bold uppercase tracking-widest text-sm">Nenhum evento registrado.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-10">
            {events.map(event => {
              const eventMedia = media.filter(m => m.eventId === event.id);
              const coverMedia = event.coverUrl || (eventMedia.length > 0 ? eventMedia[0].url : null);
              const isVideoCover = eventMedia.length > 0 && eventMedia[0].type.startsWith('video');

              return (
                <div 
                  key={event.id} 
                  className="group cursor-pointer flex flex-col items-center"
                  onClick={() => onEventClick(event)}
                >
                  <div className="w-full aspect-square border-2 border-white p-1 overflow-hidden transition-transform duration-300 group-hover:scale-105 bg-black">
                    {coverMedia ? (
                      isVideoCover ? (
                        <video src={coverMedia} className="w-full h-full object-cover" />
                      ) : (
                        <img src={coverMedia} alt={event.name} className="w-full h-full object-cover transition-all" loading="lazy" />
                      )
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                        <ImageIcon size={32} className="text-zinc-700" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-base font-bold uppercase mt-3 text-center transition-colors group-hover:text-[#004aad] px-2 leading-tight">
                    {event.name}
                  </h3>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ CANVA - Cultos e Localização */}
      <div className="mt-24 flex flex-col items-center space-y-20 border-t border-zinc-900 pt-16">
         
         <div className="w-full flex flex-col items-center justify-center gap-6">
           <h3 className="text-5xl md:text-6xl text-3d-canva mb-2">Cultos :</h3>
           <p className="text-3xl md:text-4xl text-3d-canva text-center w-full">
             DOMINGO 19H00
           </p>
           <p className="text-3xl md:text-4xl text-3d-canva text-center w-full mb-8">
             QUINTA 19H30
           </p>
           
           <h3 className="text-4xl md:text-5xl text-3d-canva mt-8 mb-2 text-center w-full">
             ESTUDO BÍBLICO :
           </h3>
           <p className="text-3xl md:text-4xl text-3d-canva text-center w-full">
             TERÇA 19H30
           </p>
         </div>

         {/* Localização */}
         <div className="text-center w-full flex flex-col items-center gap-8">
            <h3 className="text-4xl md:text-5xl text-3d-canva">Nossa Localização :</h3>
            
            <div className="bg-[#004aad] rounded-full flex items-center p-2 pr-6 max-w-full border-2 border-[#002255] shadow-xl overflow-hidden max-w-[95%]">
               <div className="bg-white rounded-full p-3 mr-4 flex items-center justify-center flex-shrink-0">
                  <MapPin size={28} className="text-[#004aad]" fill="#004aad" />
               </div>
               <p className="font-bold uppercase text-sm md:text-base leading-tight text-left text-white tracking-widest whitespace-nowrap overflow-x-auto custom-scrollbar pb-1">
                 RUA GOVERNADOR ROBERTO<br/>SILVEIRA 396
               </p>
            </div>
         </div>

         {/* Redes Sociais com ícones inline em vez de lucide-react */}
         <div className="text-center w-full flex flex-col items-center gap-8">
            <h3 className="text-4xl md:text-5xl text-3d-canva mb-4">Redes Sociais :</h3>
            
            <div className="flex flex-col gap-6 text-left w-full max-w-[320px]">
               <div className="flex items-center gap-4">
                  <div className="bg-blue-600 rounded-full p-2 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                  </div>
                  <span className="font-bold tracking-wider text-xl">@CEVIC CEVIC</span>
               </div>
               
               <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-full p-2 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </div>
                  <span className="font-bold tracking-wider text-xl">@CEVIC_2026</span>
               </div>

               <div className="flex items-center gap-4 mt-4">
                  <div className="border-2 border-white rounded-full p-2 flex-shrink-0">
                     <Radio size={28} className="text-white" />
                  </div>
                  <span className="font-bold text-sm tracking-wide leading-tight">Lives, Conteúdos, Anúncios<br/>e Muito Mais !</span>
               </div>
            </div>
         </div>

         <div className="mt-8 pt-12 pb-8 border-t border-zinc-900 w-full flex justify-center items-center">
             <p className="text-2xl md:text-3xl text-3d-canva text-center px-4 pb-2 leading-loose">
               CEVIC<br/>
               QUEM GOSTA VEM<br/>
               QUEM AMA FICA!
             </p>
         </div>
      </div>
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors uppercase font-bold text-sm tracking-wider">
          <ChevronLeft size={20} /> Voltar
        </button>
        <button onClick={onShare} className="flex items-center gap-2 text-[#004aad] hover:text-blue-400 transition-colors uppercase font-bold text-sm tracking-wider">
          <Share2 size={18} /> Compartilhar
        </button>
      </div>

      <div className="border-b border-white/20 pb-6 text-center">
        <h2 className="text-3xl md:text-4xl font-black italic uppercase text-[#004aad]">{event.name}</h2>
        <p className="text-zinc-400 text-sm mt-2 font-bold tracking-widest">{media.length} {media.length === 1 ? 'ARQUIVO' : 'ARQUIVOS'}</p>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 border border-zinc-800 p-1">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-xl uppercase font-bold">Nenhuma foto adicionada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {media.map((item) => (
            <div 
              key={item.id} 
              className="cursor-pointer group aspect-square border border-white/30 p-1 bg-black hover:border-white transition-colors" 
              onClick={() => setLightboxItem(item)}
            >
              {item.type.startsWith('video') ? (
                <div className="relative w-full h-full">
                  <video src={item.url} className="w-full h-full object-cover" />
                  <Play size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 drop-shadow-md" />
                </div>
              ) : (
                <img src={item.url} alt="Galeria" className="w-full h-full object-cover transition-all" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Mode */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxItem(null)}>
          <button className="absolute top-4 right-4 text-white z-50 p-2" onClick={() => setLightboxItem(null)}><X size={32} /></button>
          {currentIndex > 0 && <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 text-white p-2 z-50 drop-shadow-lg"><ChevronLeft size={48} /></button>}
          
          <div className="max-w-5xl max-h-screen relative flex items-center justify-center border-2 border-white p-2 bg-black" onClick={e => e.stopPropagation()}>
            {lightboxItem.type.startsWith('video') ? (
              <video src={lightboxItem.url} controls autoPlay className="max-h-[80vh] max-w-full" />
            ) : (
              <img src={lightboxItem.url} alt="Tela cheia" className="max-h-[80vh] max-w-full object-contain" />
            )}
          </div>

          {currentIndex < media.length - 1 && <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 text-white p-2 z-50 drop-shadow-lg"><ChevronRight size={48} /></button>}
        </div>
      )}
    </div>
  );
}

function AdminView({ events, media, user, db, appId, isDemoMode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Senha de administrador
  const ADMIN_PASSWORD = "midiacevic"; 

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (password === ADMIN_PASSWORD) setIsAuthenticated(true);
    else { setLoginError("Senha incorreta."); setPassword(''); }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full border border-white/20 p-8 bg-black/50 text-center mt-12">
        <Lock size={48} className="mx-auto mb-6 text-zinc-500" />
        <h2 className="text-2xl font-black italic uppercase tracking-widest mb-2">Área Restrita</h2>
        <p className="text-zinc-400 text-xs uppercase mb-8 tracking-wider">Acesso exclusivo para envio de mídias.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="SENHA DE ACESSO" 
            className="w-full bg-transparent border-b-2 border-white/30 px-4 py-3 text-white text-center tracking-[0.3em] focus:outline-none focus:border-white transition-colors uppercase font-bold" required
          />
          {loginError && <p className="text-red-500 text-sm font-bold uppercase">{loginError}</p>}
          <Button type="submit" className="w-full mt-6 py-4 uppercase tracking-widest bg-[#004aad] hover:bg-blue-700">Entrar</Button>
        </form>
      </div>
    );
  }

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
    const selectedFiles = Array.from(e.target.files);
    let hasError = false;
    const validFiles = selectedFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/');
      if (!isValidType) hasError = true;
      return isValidType;
    });
    if (hasError) showAlert("Alguns arquivos possuem formato não suportado.");

    const totalAtual = eventMedia.length + files.length;
    const espacoRestante = 300 - totalAtual;
    if (espacoRestante <= 0) {
      showAlert("Limite máximo atingido!");
      if(fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    let arquivosParaAdicionar = validFiles;
    if (validFiles.length > espacoRestante) arquivosParaAdicionar = validFiles.slice(0, espacoRestante);
    setFiles(prev => [...prev, ...arquivosParaAdicionar]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove) => setFiles(files.filter((_, index) => index !== indexToRemove));

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;
    try {
      if (isDemoMode) {
        const newEvent = { id: Date.now().toString(), name: newEventName.trim(), createdAt: Date.now(), coverUrl: null };
        const existing = JSON.parse(localStorage.getItem('cevic_events') || '[]');
        localStorage.setItem('cevic_events', JSON.stringify([newEvent, ...existing]));
        triggerLocalUpdate();
        setSelectedEventId(newEvent.id);
        setIsCreatingEvent(false);
        setNewEventName('');
        return;
      }
      const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
      const docRef = await addDoc(eventsRef, { name: newEventName.trim(), createdAt: serverTimestamp(), coverUrl: null });
      setSelectedEventId(docRef.id);
      setIsCreatingEvent(false);
      setNewEventName('');
    } catch (error) { showAlert("Erro ao criar evento."); }
  };

  const handleDeleteMedia = (mediaId) => {
    showConfirm("Excluir este arquivo permanentemente?", async () => {
      if (isDemoMode) {
        const existing = JSON.parse(localStorage.getItem('cevic_media') || '[]');
        localStorage.setItem('cevic_media', JSON.stringify(existing.filter(m => m.id !== mediaId)));
        triggerLocalUpdate();
        return;
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'media', mediaId));
    });
  };

  const handleDeleteEvent = () => {
    showConfirm("ATENÇÃO: Excluir este evento e TODOS os seus arquivos?", async () => {
      if (isDemoMode) {
           const existingEvents = JSON.parse(localStorage.getItem('cevic_events') || '[]');
           const existingMedia = JSON.parse(localStorage.getItem('cevic_media') || '[]');
           localStorage.setItem('cevic_events', JSON.stringify(existingEvents.filter(e => e.id !== selectedEventId)));
           localStorage.setItem('cevic_media', JSON.stringify(existingMedia.filter(m => m.eventId !== selectedEventId)));
           triggerLocalUpdate();
           setSelectedEventId('');
           return;
      }
      for (const m of eventMedia) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'media', m.id));
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', selectedEventId));
      setSelectedEventId('');
    });
  };

  const startUpload = async () => {
    if (!selectedEventId || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    let completed = 0;

    for (const file of files) {
      try {
        let downloadUrl = "";
        
        if (!isDemoMode && CLOUDINARY_CLOUD_NAME) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
          
          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body: formData });
          const data = await response.json();
          downloadUrl = data.secure_url;
        } else {
           downloadUrl = await simulateLocalUpload(file);
        }

        if (isDemoMode) {
          const newMedia = { id: Date.now().toString() + Math.random(), eventId: selectedEventId, url: downloadUrl, type: file.type, name: file.name, createdAt: Date.now() };
          const existing = JSON.parse(localStorage.getItem('cevic_media') || '[]');
          localStorage.setItem('cevic_media', JSON.stringify([...existing, newMedia]));
          triggerLocalUpdate();
        } else {
          const mediaRef = collection(db, 'artifacts', appId, 'public', 'data', 'media');
          await addDoc(mediaRef, { eventId: selectedEventId, url: downloadUrl, type: file.type, name: file.name, createdAt: serverTimestamp() });
        }
        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));
      } catch (error) { console.error("Erro no arquivo:", file.name); }
    }
    setUploading(false);
    setFiles([]);
    showAlert("Upload concluído!");
  };

  return (
    <div className="space-y-6 mt-12 pb-12">
      <div className="flex justify-between items-center border-b border-white/20 pb-4">
        <h2 className="text-2xl font-black italic uppercase tracking-wider text-[#004aad]">Acesso da Mídia</h2>
        {selectedEventId && !isCreatingEvent && (
          <button onClick={handleDeleteEvent} className="text-red-500 font-bold uppercase text-xs flex items-center gap-1"><Trash2 size={14}/> Excluir</button>
        )}
      </div>

      <div className="border border-white/20 p-4">
        {!isCreatingEvent ? (
          <div className="flex flex-col gap-3">
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="bg-transparent border border-white/30 p-3 uppercase font-bold text-sm text-zinc-300">
              <option value="" className="text-black">SELECIONE UM EVENTO</option>
              {events.map(ev => <option key={ev.id} value={ev.id} className="text-black">{ev.name}</option>)}
            </select>
            <Button onClick={() => setIsCreatingEvent(true)} className="bg-zinc-800 hover:bg-zinc-700 uppercase tracking-widest text-xs py-3">Novo Evento</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input type="text" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="NOME DO EVENTO" className="bg-transparent border border-white/30 p-3 uppercase font-bold text-sm text-white" autoFocus />
            <div className="flex gap-2">
              <Button onClick={handleCreateEvent} className="bg-green-600 hover:bg-green-700 flex-1">Salvar</Button>
              <Button onClick={() => setIsCreatingEvent(false)} className="bg-zinc-600 hover:bg-zinc-500 flex-1">Voltar</Button>
            </div>
          </div>
        )}
      </div>

      {selectedEventId && !isCreatingEvent && eventMedia.length > 0 && (
         <div className="border border-white/20 p-4">
            <h3 className="text-sm font-bold uppercase mb-4 tracking-widest text-zinc-400">Arquivos do Álbum ({eventMedia.length}/300)</h3>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
               {eventMedia.map(item => (
                 <div key={item.id} className="relative aspect-square border border-white/20 p-1 group">
                    {item.type.startsWith('video') ? <div className="bg-zinc-800 w-full h-full flex items-center justify-center"><Video size={20}/></div> : <img src={item.url} className="w-full h-full object-cover" />}
                    <button onClick={() => handleDeleteMedia(item.id)} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
                 </div>
               ))}
            </div>
         </div>
      )}

      <div className={`border-2 border-dashed p-8 text-center transition-colors ${selectedEventId ? 'border-white/40' : 'border-zinc-800 pointer-events-none'}`}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,video/*" />
        <Camera size={32} className="mx-auto mb-4 opacity-50" />
        
        {selectedEventId && (
          <p className="text-xs uppercase font-bold tracking-widest text-zinc-400 mb-4">
            Limite: {(eventMedia.length + files.length)}/300 arquivos
          </p>
        )}

        {(eventMedia.length + files.length) >= 300 ? (
          <p className="text-red-500 font-bold uppercase text-xs tracking-widest">Capacidade máxima atingida</p>
        ) : (
          <Button onClick={() => fileInputRef.current?.click()} className="mx-auto text-xs uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700">Selecionar Mídia</Button>
        )}
      </div>

      {files.length > 0 && (
        <div className="border border-white/20 p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            {files.map((file, idx) => (
              <div key={idx} className="relative aspect-square border border-white p-1">
                {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" /> : <div className="bg-zinc-800 w-full h-full flex items-center justify-center"><Video size={20}/></div>}
                {!uploading && <button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-red-600 p-1"><X size={12} /></button>}
              </div>
            ))}
          </div>
          {uploading ? (
            <div className="bg-zinc-900 border border-zinc-800 p-4 text-center text-xs font-bold uppercase tracking-widest text-[#004aad]">
              Enviando... {uploadProgress}%
            </div>
          ) : (
            <Button onClick={startUpload} className="w-full py-4 text-sm tracking-widest uppercase bg-[#004aad] hover:bg-blue-700">Começar Upload</Button>
          )}
        </div>
      )}

      {modalConfig && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="border-2 border-white p-6 bg-black w-full text-center">
            <h3 className="text-xl font-black italic uppercase mb-4 text-[#004aad]">{modalConfig.type === 'confirm' ? 'Atenção' : 'Aviso'}</h3>
            <p className="text-sm font-bold uppercase mb-6 tracking-wide">{modalConfig.message}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setModalConfig(null)} className="bg-zinc-700 hover:bg-zinc-600">Fechar</Button>
              {modalConfig.type === 'confirm' && <Button onClick={() => { modalConfig.onConfirm(); setModalConfig(null); }} className="bg-red-600 hover:bg-red-700">Confirmar</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}