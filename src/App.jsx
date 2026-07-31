import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Video, Upload, Share2, Lock, X, ChevronLeft, ChevronRight, Plus, Image as ImageIcon, Play, CheckCircle, Trash2 } from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Initialize Firebase safely
let app, auth, db, storage;
// Nome do ID da aplicação no banco
const appId = '1:832876748713:web:e8e57b26540c64eb3d6eb8';
const dummyKey = "AIzaSyBz2yfCPZ1BYfkV08qh1D6rFC9Pomz4H0c";
let isDemoMode = false;

try {
  // COLE AQUI AS CHAVES DO SEU FIREBASE (Passo 4 do Tutorial)
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || dummyKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "galeria-cevic.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "galeria-cevic",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "galeria-cevic.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "832876748713",
    appId: env.VITE_FIREBASE_APP_ID || "1:832876748713:web:e8e57b26540c64eb3d6eb8"
  };
  
  isDemoMode = firebaseConfig.apiKey === dummyKey;

  if (!isDemoMode) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Fallback for local testing without real Firebase Storage
const simulateLocalUpload = (file) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    setTimeout(() => resolve(url), 1500); // Simulate network delay
  });
};

// UI Components
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
  const [currentView, setCurrentView] = useState('home'); // 'home', 'event', 'admin'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [media, setMedia] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  // Logo provided by the user
  const logoSrc = "/logo.jpg";

  const loadLocalData = useCallback(() => {
    setEvents(JSON.parse(localStorage.getItem('cevic_events') || '[]'));
    setMedia(JSON.parse(localStorage.getItem('cevic_media') || '[]'));
  }, []);

  // Authentication Effect
  useEffect(() => {
    if (isDemoMode) {
      setUser({ uid: 'demo-user', isAnonymous: true });
      return;
    }

    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn("Aviso de Autenticação (esperado no modo teste sem chaves):", err.message);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Fetch Events and Media Effect (Real-time)
  useEffect(() => {
    if (isDemoMode) {
      loadLocalData();
      window.addEventListener('localDataChanged', loadLocalData);
      return () => window.removeEventListener('localDataChanged', loadLocalData);
    }

    if (!user || !db) return;
    
    // Listen to Events
    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      eventsData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setEvents(eventsData);
    }, (error) => console.warn("Aviso no DB de Eventos:", error.message));

    // Listen to Media (Corrigido para carregar arquivos da nuvem na versão real)
    const mediaRef = collection(db, 'artifacts', appId, 'public', 'data', 'media');
    const unsubMedia = onSnapshot(mediaRef, (snapshot) => {
      const mediaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mediaData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setMedia(mediaData);
    }, (error) => console.warn("Aviso no DB de Mídia:", error.message));

    return () => {
      unsubEvents();
      unsubMedia();
    };
  }, [user]);

  // Read Shared URL (Direct link to Event)
  useEffect(() => {
    if (events.length > 0 && initialLoad) {
      const params = new URLSearchParams(window.location.search);
      const eventId = params.get('event');
      
      if (eventId) {
        const sharedEvent = events.find(e => e.id === eventId);
        if (sharedEvent) {
          setSelectedEvent(sharedEvent);
          setCurrentView('event');
        } else {
          showToast("Evento não encontrado ou já foi excluído.");
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
    setSelectedEvent(event); // Correção: Agora o aplicativo lembra qual evento você clicou!
    try {
      if (event) {
        // Altera a URL no navegador sem recarregar a página para refletir o evento
        window.history.pushState({}, '', `?event=${event.id}`);
      } else {
        // Limpa a URL ao voltar para a home ou admin
        window.history.pushState({}, '', window.location.pathname);
      }
    } catch (err) {
      console.warn("Ambiente de teste bloqueia alteração de URL. Ignorando silenciosamente.");
    }
    window.scrollTo(0, 0);
  };

  const shareLink = (eventId = null) => {
    // In a real deployed app, this would be the actual URL.
    // We simulate it here for the immersive environment.
    const url = window.location.href.split('?')[0] + (eventId ? `?event=${eventId}` : '');
    
    // Fallback para garantir cópia dentro de iframes (como a janela de preview)
    const fallbackCopyTextToClipboard = (text) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Esconde o textarea da interface
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          showToast("Link copiado para a área de transferência!");
        } else {
          showToast("Erro ao copiar o link.");
        }
      } catch (err) {
        showToast("Erro ao copiar o link manualmente.");
      }
      document.body.removeChild(textArea);
    };

    // Tenta usar a API moderna primeiro, se falhar ou não existir, usa o fallback
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => showToast("Link copiado para a área de transferência!"))
        .catch(() => fallbackCopyTextToClipboard(url));
    } else {
      fallbackCopyTextToClipboard(url);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => navigateTo('home')}
          >
            <img 
              src={logoSrc} 
              alt="GALERIA CEVIC Logo" 
              className="h-14 w-14 object-cover rounded-full border-2 border-zinc-800 group-hover:border-blue-500 transition-colors"
              onError={(e) => {
                e.target.onerror = null; 
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMyMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPkM8L3RleHQ+PC9zdmc+';
              }}
            />
            <h1 className="text-2xl font-bold tracking-widest uppercase">GALERIA CEVIC</h1>
          </div>
          
          <nav className="flex gap-3">
            <Button 
              className={currentView === 'home' ? 'bg-blue-700' : 'bg-transparent text-zinc-300 hover:bg-zinc-800'} 
              onClick={() => navigateTo('home')}
            >
              Eventos
            </Button>
            <Button 
              className={currentView === 'admin' ? 'bg-blue-700' : 'bg-transparent text-zinc-300 hover:bg-zinc-800'}
              onClick={() => navigateTo('admin')}
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Administrar</span>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'home' && (
          <HomeView 
            events={events} 
            media={media} 
            onEventClick={(evt) => navigateTo('event', evt)} 
          />
        )}
        {currentView === 'event' && selectedEvent && (
          <EventView 
            event={selectedEvent} 
            media={media.filter(m => m.eventId === selectedEvent.id)} 
            onBack={() => navigateTo('home')}
            onShare={() => shareLink(selectedEvent.id)}
          />
        )}
        {currentView === 'admin' && (
          <AdminView 
            events={events} 
            media={media}
            user={user} 
            db={db}
            appId={appId}
            isDemoMode={isDemoMode}
          />
        )}
      </main>

      {/* Toast Notification */}
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
          <p className="text-sm mt-2">Acesse a área de administração para adicionar fotos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {events.map(event => {
            // Find cover image (most recent media for this event, or standard cover)
            const eventMedia = media.filter(m => m.eventId === event.id);
            const coverMedia = event.coverUrl || (eventMedia.length > 0 ? eventMedia[0].url : null);
            const isVideoCover = eventMedia.length > 0 && eventMedia[0].type.startsWith('video');

            return (
              <div 
                key={event.id} 
                className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-blue-500 transition-colors cursor-pointer shadow-lg"
                onClick={() => onEventClick(event)}
              >
                <div className="aspect-[4/3] bg-zinc-800 relative overflow-hidden">
                  {coverMedia ? (
                     isVideoCover ? (
                       <video src={coverMedia} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-500" />
                     ) : (
                       <img src={coverMedia} alt={event.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all group-hover:scale-105 duration-500" loading="lazy" />
                     )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={48} className="text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                  
                  {/* Indicator for new files could be added here based on dates */}
                  {eventMedia.length > 0 && (
                    <div className="absolute top-3 right-3 bg-blue-600 text-xs font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">
                      {eventMedia.length} {eventMedia.length === 1 ? 'item' : 'itens'}
                    </div>
                  )}
                </div>
                
                <div className="p-5 relative">
                <h3 className="text-xl font-bold truncate group-hover:text-blue-400 transition-colors">{event.name}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {event.createdAt ? new Date(event.createdAt.toMillis ? event.createdAt.toMillis() : event.createdAt).toLocaleDateString('pt-BR') : 'Recente'}
                </p>
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

  const goNext = (e) => {
    e.stopPropagation();
    if (currentIndex < media.length - 1) setLightboxItem(media[currentIndex + 1]);
  };

  const goPrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) setLightboxItem(media[currentIndex - 1]);
  };

  // Navegação pelo teclado para o visualizador (Lightbox)
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
      {/* Header do Evento */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} className="bg-zinc-800 hover:bg-zinc-700 px-3">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold">{event.name}</h2>
            <p className="text-zinc-400 text-sm">{media.length} {media.length === 1 ? 'item' : 'itens'}</p>
          </div>
        </div>
        <Button onClick={onShare} className="bg-zinc-800 hover:bg-zinc-700 text-sm">
          <Share2 size={16} /> Compartilhar Álbum
        </Button>
      </div>

      {/* Galeria Masonry (Colunas CSS) */}
      {media.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-xl">Nenhuma foto ou vídeo adicionado ainda.</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {media.map((item) => (
            <div 
              key={item.id} 
              className="break-inside-avoid cursor-pointer group relative rounded-xl overflow-hidden border border-zinc-800 hover:border-blue-500 transition-all shadow-md bg-zinc-900" 
              onClick={() => setLightboxItem(item)}
            >
              {item.type.startsWith('video') ? (
                <div className="relative">
                  <video src={item.url} className="w-full object-cover" />
                  <Play size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 group-hover:text-white group-hover:scale-110 transition-all drop-shadow-lg" />
                </div>
              ) : (
                <img src={item.url} alt="Galeria" className="w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox (Visualizador em Tela Cheia) */}
      {lightboxItem && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 sm:p-8 backdrop-blur-md" 
          onClick={() => setLightboxItem(null)}
        >
          <button 
            className="absolute top-4 right-4 text-zinc-400 hover:text-white z-50 p-2 transition-colors bg-zinc-900/50 rounded-full"
            onClick={() => setLightboxItem(null)}
          >
            <X size={28} />
          </button>
          
          {currentIndex > 0 && (
            <button 
              onClick={goPrev} 
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-2 z-50 transition-colors bg-zinc-900/50 hover:bg-blue-600 rounded-full"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          
          <div className="max-w-5xl max-h-screen relative w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {lightboxItem.type.startsWith('video') ? (
              <video src={lightboxItem.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-md shadow-2xl" />
            ) : (
              <img src={lightboxItem.url} alt="Em tela cheia" className="max-h-[85vh] max-w-full object-contain rounded-md shadow-2xl" />
            )}
          </div>

          {currentIndex < media.length - 1 && (
            <button 
              onClick={goNext} 
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-2 z-50 transition-colors bg-zinc-900/50 hover:bg-blue-600 rounded-full"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AdminView({ events, media, user, db, appId, isDemoMode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Hardcoded password for application logic as requested (shared password)
  const ADMIN_PASSWORD = "cevic"; 

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      setLoginError("Senha incorreta. Tente novamente.");
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto bg-zinc-800 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-blue-500">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold">Área Restrita</h2>
          <p className="text-zinc-400 text-sm mt-2">Insira a senha de acesso da igreja para enviar fotos e vídeos.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite a senha..." 
            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            required
          />
          {loginError && <p className="text-red-500 text-sm mt-2 font-medium">{loginError}</p>}
        </div>
        <Button type="submit" className="w-full py-3 text-lg">Acessar</Button>
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

  // Filtrar as mídias que pertencem ao evento atualmente selecionado
  const eventMedia = selectedEventId ? media.filter(m => m.eventId === selectedEventId) : [];

  const triggerLocalUpdate = () => window.dispatchEvent(new Event('localDataChanged'));

  const showAlert = (message) => setModalConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setModalConfig({ type: 'confirm', message, onConfirm });

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    // Basic validation
    let hasError = false;
    const validFiles = selectedFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/');
      if (!isValidType) hasError = true;
      return isValidType;
    });

    if (hasError) showAlert("Alguns arquivos possuem formato não suportado e foram ignorados.");

    // Verificação de limite máximo (300 arquivos)
    const totalAtual = eventMedia.length + files.length;
    const espacoRestante = 300 - totalAtual;

    if (espacoRestante <= 0) {
      showAlert("O limite máximo de 300 arquivos por evento foi atingido!");
      // Limpa o input file para permitir selecionar arquivos se o usuário apagar fotos
      if(fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let arquivosParaAdicionar = validFiles;
    if (validFiles.length > espacoRestante) {
      showAlert(`Limite excedido. Você pode adicionar apenas mais ${espacoRestante} arquivo(s) neste evento. O excedente foi ignorado.`);
      arquivosParaAdicionar = validFiles.slice(0, espacoRestante);
    }

    setFiles(prev => [...prev, ...arquivosParaAdicionar]);
    
    // Limpa o input file
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;
    if (!isDemoMode && (!db || !user)) return;

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
      const docRef = await addDoc(eventsRef, {
        name: newEventName.trim(),
        createdAt: serverTimestamp(),
        coverUrl: null
      });
      setSelectedEventId(docRef.id);
      setIsCreatingEvent(false);
      setNewEventName('');
    } catch (error) {
      console.error("Erro ao criar evento:", error);
      showAlert("Erro ao criar evento.");
    }
  };

  const handleDeleteMedia = (mediaId) => {
    showConfirm("Tem certeza que deseja excluir este arquivo permanentemente?", async () => {
      try {
        if (isDemoMode) {
          const existing = JSON.parse(localStorage.getItem('cevic_media') || '[]');
          localStorage.setItem('cevic_media', JSON.stringify(existing.filter(m => m.id !== mediaId)));
          triggerLocalUpdate();
          return;
        }
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'media', mediaId));
      } catch (error) {
        console.error("Erro ao remover arquivo:", error);
        showAlert("Erro ao remover arquivo. Tente novamente.");
      }
    });
  };

  const handleDeleteEvent = () => {
    showConfirm("ATENÇÃO: Tem certeza que deseja excluir ESTE EVENTO e TODOS os seus arquivos? Esta ação não pode ser desfeita.", async () => {
      try {
        if (isDemoMode) {
           const existingEvents = JSON.parse(localStorage.getItem('cevic_events') || '[]');
           const existingMedia = JSON.parse(localStorage.getItem('cevic_media') || '[]');
           localStorage.setItem('cevic_events', JSON.stringify(existingEvents.filter(e => e.id !== selectedEventId)));
           localStorage.setItem('cevic_media', JSON.stringify(existingMedia.filter(m => m.eventId !== selectedEventId)));
           triggerLocalUpdate();
           setSelectedEventId('');
           showAlert("Evento excluído com sucesso.");
           return;
        }

        // Deletar todas as fotos/vídeos associados primeiro
        for (const m of eventMedia) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'media', m.id));
        }
        // Deletar o documento do evento
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', selectedEventId));
        
        setSelectedEventId('');
        showAlert("Evento excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir evento:", error);
        showAlert("Erro ao excluir evento.");
      }
    });
  };

  const startUpload = async () => {
    if (!selectedEventId) {
      showAlert("Selecione ou crie um evento primeiro.");
      return;
    }
    if (files.length === 0) {
      showAlert("Selecione pelo menos um arquivo.");
      return;
    }
    if (!isDemoMode && (!db || !user)) {
      showAlert("Erro de conexão. Tente recarregar a página.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    let completed = 0;

    // Process files one by one for progress tracking
    for (const file of files) {
      try {
        let downloadUrl = "";

        if (!isDemoMode) {
          try {
            if (typeof storage !== 'undefined') {
               const fileRef = ref(storage, `artifacts/${appId}/public/data/uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`);
               const uploadTask = await uploadBytesResumable(fileRef, file);
               downloadUrl = await getDownloadURL(uploadTask.ref);
            } else {
               downloadUrl = await simulateLocalUpload(file);
            }
          } catch (storageError) {
            console.warn(`Storage bloqueado (${storageError.code}). Usando fallback local para visualização.`);
            downloadUrl = await simulateLocalUpload(file);
          }
        } else {
           downloadUrl = await simulateLocalUpload(file);
        }

        if (isDemoMode) {
          const newMedia = {
            id: Date.now().toString() + Math.random(),
            eventId: selectedEventId,
            url: downloadUrl,
            type: file.type,
            name: file.name,
            createdAt: Date.now()
          };
          const existing = JSON.parse(localStorage.getItem('cevic_media') || '[]');
          localStorage.setItem('cevic_media', JSON.stringify([...existing, newMedia]));
          triggerLocalUpdate();
        } else {
          // Save to Firestore
          const mediaRef = collection(db, 'artifacts', appId, 'public', 'data', 'media');
          await addDoc(mediaRef, {
            eventId: selectedEventId,
            url: downloadUrl,
            type: file.type,
            name: file.name,
            createdAt: serverTimestamp()
          });
        }

        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));

      } catch (error) {
        console.error("Erro no upload do arquivo:", file.name, error);
      }
    }

    setUploading(false);
    setFiles([]);
    showAlert("Upload concluído com sucesso! Os arquivos já estão disponíveis na galeria pública.");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
            <Upload size={24} /> Gerenciar Eventos
          </h2>
          {selectedEventId && !isCreatingEvent && (
            <Button onClick={handleDeleteEvent} className="bg-transparent border border-red-900 text-red-500 hover:bg-red-900/40 hover:text-red-400 text-sm">
              <Trash2 size={16} /> Excluir Evento
            </Button>
          )}
        </div>

        {/* Event Selection */}
        <div className="mb-8 p-6 bg-black border border-zinc-800 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 text-zinc-300">1. Selecione o Evento</h3>
          
          {!isCreatingEvent ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none"
              >
                <option value="" disabled>-- Escolha um evento --</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              <Button onClick={() => setIsCreatingEvent(true)} className="bg-zinc-800 hover:bg-zinc-700">
                <Plus size={18} /> Novo Evento
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Ex: Culto de Páscoa 2026" 
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateEvent} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">Criar</Button>
                <Button onClick={() => setIsCreatingEvent(false)} className="bg-zinc-700 hover:bg-zinc-600 w-full sm:w-auto">Cancelar</Button>
              </div>
            </div>
          )}
        </div>

        {/* Existing Media Management */}
        {selectedEventId && !isCreatingEvent && (
          <div className="mb-8 p-6 bg-black border border-zinc-800 rounded-xl">
            <h3 className="text-lg font-semibold mb-4 text-zinc-300">
              2. Arquivos Existentes ({eventMedia.length}/300)
            </h3>
            
            {eventMedia.length === 0 ? (
              <p className="text-zinc-500 text-sm italic">Nenhum arquivo neste evento. Faça o upload abaixo.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {eventMedia.map((mediaItem) => (
                  <div key={mediaItem.id} className="relative group bg-zinc-800 rounded-lg aspect-square flex items-center justify-center overflow-hidden border border-zinc-700">
                    {mediaItem.type.startsWith('video') ? (
                      <div className="w-full h-full relative">
                        <video src={mediaItem.url} className="w-full h-full object-cover opacity-60" />
                        <Play size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                      </div>
                    ) : (
                      <img src={mediaItem.url} alt="media" className="w-full h-full object-cover" />
                    )}
                    
                    {/* Botão de excluir que aparece no hover */}
                    <button 
                      onClick={() => handleDeleteMedia(mediaItem.id)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 hover:scale-110 shadow-lg"
                      title="Excluir arquivo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File Selection */}
        <div className={`mb-8 p-6 border-2 border-dashed rounded-xl text-center transition-colors ${selectedEventId ? 'border-zinc-600 hover:border-blue-500 bg-black/50' : 'border-zinc-800 bg-black/20 opacity-50 pointer-events-none'}`}>
          <h3 className="text-lg font-semibold mb-2 text-zinc-300">
            {selectedEventId ? '3. Adicionar Novos Arquivos' : '2. Adicione Fotos e Vídeos'}
          </h3>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden" 
            multiple 
            accept="image/*,video/*"
          />
          
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="flex gap-4 text-zinc-500">
              <Camera size={40} />
              <Video size={40} />
            </div>
            <p className="text-zinc-400">Clique abaixo para selecionar arquivos do seu dispositivo.</p>
            
            {eventMedia.length + files.length >= 300 ? (
              <p className="text-red-500 font-bold mt-2">Capacidade máxima atingida (300/300)</p>
            ) : (
              <Button onClick={() => fileInputRef.current?.click()} className="mt-2">
                Escolher Arquivos
              </Button>
            )}
          </div>
        </div>

        {/* Preview & Upload Progress */}
        {files.length > 0 && (
          <div className="space-y-6 bg-black border border-zinc-800 p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-zinc-300 border-b border-zinc-800 pb-2">Revisão ({files.length} novos arquivos)</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, idx) => (
                <div key={idx} className="relative group bg-zinc-800 rounded-lg aspect-square flex items-center justify-center overflow-hidden">
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400 p-2 text-center">
                       <Video size={32} className="mb-2" />
                       <span className="text-xs truncate w-full">{file.name}</span>
                    </div>
                  )}
                  
                  {!uploading && (
                    <button 
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {uploading ? (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-blue-400">Enviando arquivos...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <Button onClick={startUpload} className="w-full py-4 text-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800">
                <Upload size={20} /> Iniciar Upload para a Galeria
              </Button>
            )}
          </div>
        )}

        {/* Modal de Aviso / Confirmação */}
        {modalConfig && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-4 text-white">
                {modalConfig.type === 'confirm' ? 'Atenção' : 'Aviso'}
              </h3>
              <p className="text-zinc-300 mb-6">{modalConfig.message}</p>
              <div className="flex gap-3 justify-end">
                <Button 
                  onClick={() => setModalConfig(null)} 
                  className={modalConfig.type === 'confirm' ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-blue-600 hover:bg-blue-700'}
                >
                  {modalConfig.type === 'confirm' ? 'Cancelar' : 'OK'}
                </Button>
                {modalConfig.type === 'confirm' && (
                  <Button 
                    onClick={() => { modalConfig.onConfirm(); setModalConfig(null); }} 
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Confirmar
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Estilo embutido para a scrollbar customizada */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #18181b; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b; 
        }
      `}} />
    </div>
  );
}