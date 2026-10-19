import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  MessageSquare,
  Trash2,
  Image as ImageIcon,
  Globe,
  Mic,
  MicOff,
  Volume2,
  Square,
  Copy,
  Sun,
  Moon,
  Menu,
  X,
  Wand2,
  ExternalLink,
  RefreshCw,
  User,
  Bot,
  SlidersHorizontal,
  Download,
  KeyRound
} from 'lucide-react';

import FormattedMessage from './components/FormattedMessage.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { PERSONAS, STARTER_PROMPTS, DEFAULT_MODELS, STORAGE_KEYS } from './lib/constants.js';
import { generateChat, generateImage, generateSpeech, copyTextToClipboard, friendlyError } from './lib/gemini.js';

/* ---------- small persistence helpers (safe in private mode) ---------- */
const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked - the app still works for this session */
  }
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const makeSession = (title = 'New Chat') => ({
  id: `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  title,
  messages: [],
  createdAt: now()
});

export default function App() {
  /* ---- preferences ---- */
  const [darkMode, setDarkMode] = useState(() => readJSON(STORAGE_KEYS.prefs, {})?.darkMode ?? true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.apiKey) || '');
  const [models, setModels] = useState(() => readJSON(STORAGE_KEYS.prefs, {})?.models || DEFAULT_MODELS);
  const [voice, setVoice] = useState(() => readJSON(STORAGE_KEYS.prefs, {})?.voice || 'Kore');

  /* ---- chat state (persisted) ---- */
  const [sessions, setSessions] = useState(() => {
    const saved = readJSON(STORAGE_KEYS.sessions, null);
    return Array.isArray(saved) && saved.length ? saved : [makeSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = readJSON(STORAGE_KEYS.sessions, null);
    return Array.isArray(saved) && saved.length ? saved[0].id : null;
  });

  /* ---- ui state ---- */
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'image'
  const [useGoogleSearch, setUseGoogleSearch] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const personaMenuRef = useRef(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2800);
  }, []);

  /* ---- persist ---- */
  useEffect(() => {
    writeJSON(STORAGE_KEYS.sessions, sessions);
  }, [sessions]);
  useEffect(() => {
    writeJSON(STORAGE_KEYS.prefs, { darkMode, models, voice });
  }, [darkMode, models, voice]);
  useEffect(() => {
    if (apiKey) localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
    else localStorage.removeItem(STORAGE_KEYS.apiKey);
  }, [apiKey]);

  /* ---- effects ---- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isGenerating]);

  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  // Close the persona dropdown on outside click / Escape.
  useEffect(() => {
    if (!showPersonaMenu) return;
    const onDown = (e) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target)) setShowPersonaMenu(false);
    };
    const onKey = (e) => e.key === 'Escape' && setShowPersonaMenu(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPersonaMenu]);

  /* ---- voice input ---- */
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Aapke browser me Voice Input supported nahi hai.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN'; // handles Hindi, Hinglish & Indian English
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      showToast('Boliye, Gimmi sun raha hai...');
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* ---- image upload ---- */
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Kripya sirf image file select karein.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage({
        data: reader.result.split(',')[1],
        mimeType: file.type,
        preview: reader.result,
        name: file.name
      });
      setActiveMode('chat');
      showToast('Photo attach ho gayi! Ab apna sawal puchein.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ---- sessions ---- */
  const createNewChat = () => {
    const s = makeSession();
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setInput('');
    setUploadedImage(null);
    setActiveMode('chat');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === 0) {
      const s = makeSession();
      setSessions([s]);
      setActiveSessionId(s.id);
    } else {
      setSessions(filtered);
      if (activeSessionId === id) setActiveSessionId(filtered[0].id);
    }
  };

  const appendMessage = (sessionId, message) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, messages: [...s.messages, message] } : s))
    );
  };

  /* ---- read aloud ---- */
  const handlePlayTTS = async (msgId, text) => {
    if (playingMsgId === msgId) {
      audioRef.current?.pause();
      setPlayingMsgId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();

    if (!apiKey) {
      setSettingsOpen(true);
      showToast('Pehle API key daalein.');
      return;
    }

    try {
      setLoadingAudioId(msgId);
      const cleanText = text
        .replace(/```[\s\S]*?```/g, ' Code block provided below. ')
        .replace(/[*#_`~>-]/g, ' ')
        .slice(0, 900);

      const audioUrl = await generateSpeech({ apiKey, model: models.tts, voice, text: cleanText });
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingMsgId(msgId);
      audio.onended = () => setPlayingMsgId(null);
      audio.onerror = () => {
        setPlayingMsgId(null);
        showToast('Voice playback me dikkat aayi.');
      };
      await audio.play();
    } catch (err) {
      showToast(friendlyError(err));
    } finally {
      setLoadingAudioId(null);
    }
  };

  /* ---- send ---- */
  const handleSendMessage = async (customPrompt = null, forcedMode = null) => {
    const promptText = (customPrompt !== null ? customPrompt : input).trim();
    if ((!promptText && !uploadedImage) || isGenerating) return;

    if (!apiKey) {
      setSettingsOpen(true);
      showToast('Sab features chalane ke liye apni Gemini API key daalein.');
      return;
    }

    const sessionId = activeSession.id;
    const currentMode = forcedMode || activeMode;
    const currentImage = uploadedImage;

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: promptText || 'Is photo ko analyze karke batao.',
      image: currentImage?.preview || null,
      timestamp: now()
    };

    const updatedMessages = [...activeSession.messages, userMessage];
    const newTitle =
      activeSession.messages.length === 0 ? (promptText || 'Image Analysis').slice(0, 32) : activeSession.title;

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle, messages: updatedMessages } : s))
    );
    setInput('');
    setUploadedImage(null);
    setIsGenerating(true);

    const looksLikeImageRequest =
      currentMode === 'image' ||
      /^(draw|generate an image|create an image|make a picture|photo banao|image banao|image bana)/i.test(promptText);

    try {
      /* --- image generation path --- */
      if (looksLikeImageRequest && !currentImage) {
        const { imageUrl, note } = await generateImage({ apiKey, model: models.image, prompt: promptText });
        appendMessage(sessionId, {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          text: note || `Yeh lijiye aapki generated AI image: **"${promptText}"**`,
          generatedImage: imageUrl,
          timestamp: now()
        });
        setActiveMode('chat');
        return;
      }

      /* --- chat / vision path --- */
      const historyContents = updatedMessages.slice(-10).map((m, idx, arr) => {
        const isLastUserMsg = idx === arr.length - 1 && m.role === 'user';
        const parts = [{ text: m.text }];
        if (isLastUserMsg && currentImage) {
          parts.push({ inlineData: { mimeType: currentImage.mimeType, data: currentImage.data } });
        }
        return { role: m.role === 'user' ? 'user' : 'model', parts };
      });

      const { text, sources } = await generateChat({
        apiKey,
        model: models.chat,
        contents: historyContents,
        systemInstruction: selectedPersona.instruction,
        useSearch: useGoogleSearch && !currentImage
      });

      appendMessage(sessionId, {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text,
        sources,
        personaName: selectedPersona.name,
        timestamp: now()
      });
    } catch (error) {
      appendMessage(sessionId, {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        isError: true,
        text: `⚠️ **Problem:** ${friendlyError(error)}`,
        timestamp: now()
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSettings = ({ apiKey: k, models: m, voice: v }) => {
    setApiKey(k);
    setModels(m);
    setVoice(v);
    showToast('Settings save ho gayi!');
  };

  const effectiveDark = darkMode;

  return (
    <div
      className={`${
        effectiveDark ? 'dark bg-[#0e1117] text-slate-100' : 'bg-[#f8fafc] text-slate-800'
      } flex h-screen w-full overflow-hidden font-sans transition-colors duration-200`}
    >
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 text-white text-xs sm:text-sm font-medium shadow-xl animate-rise">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Settings */}
      {settingsOpen && (
        <SettingsModal
          darkMode={effectiveDark}
          initial={{ apiKey, models, voice }}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-0'
        } fixed md:relative z-30 h-full flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${
          effectiveDark ? 'bg-[#161b22] border-r border-slate-800/80' : 'bg-slate-100 border-r border-slate-200'
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
                Gimmi AI
              </span>
              <span className="block text-[10px] text-slate-400 -mt-1">Powered by Gemini</span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
            className="p-1.5 rounded-lg hover:bg-slate-700/40 text-slate-400 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 mb-3">
          <button
            onClick={createNewChat}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
              effectiveDark
                ? 'bg-slate-800/90 hover:bg-slate-700/80 text-slate-100 border border-slate-700/60'
                : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
            }`}
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>New Chat / Nayi Baat</span>
          </button>
        </div>

        <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recent Chats
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => {
                setActiveSessionId(session.id);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                session.id === activeSessionId
                  ? effectiveDark
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-medium'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium'
                  : effectiveDark
                  ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-75" />
                <span className="truncate">{session.title}</span>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                aria-label={`Delete chat ${session.title}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-rose-500/20 hover:text-rose-400 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div
          className={`p-3 border-t text-xs space-y-2 ${
            effectiveDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-200/40'
          }`}
        >
          <button
            onClick={() => setSettingsOpen(true)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
              effectiveDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>API Key &amp; Models</span>
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                apiKey ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {apiKey ? 'Set' : 'Missing'}
            </span>
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
              effectiveDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              {effectiveDark ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>{effectiveDark ? 'Dark Theme' : 'Light Theme'}</span>
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
              Switch
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        <header
          className={`h-16 px-4 flex items-center justify-between border-b shrink-0 z-10 ${
            effectiveDark ? 'bg-[#0e1117]/90 border-slate-800/80' : 'bg-white/90 border-slate-200'
          } backdrop-blur-md`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
              className={`p-2 rounded-xl transition-colors ${
                effectiveDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-pink-500 bg-clip-text text-transparent">
                Gimmi
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-pink-500/20 text-indigo-400 border border-indigo-500/30">
                AI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <div className="relative" ref={personaMenuRef}>
              <button
                onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                aria-haspopup="true"
                aria-expanded={showPersonaMenu}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                  effectiveDark
                    ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">{selectedPersona.name}</span>
                <span className="sm:hidden">Persona</span>
              </button>

              {showPersonaMenu && (
                <div
                  className={`absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl border p-2 z-40 ${
                    effectiveDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Choose AI Style
                  </div>
                  {PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPersona(p);
                        setShowPersonaMenu(false);
                        showToast(`${p.name} mode activate ho gaya!`);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex flex-col gap-0.5 ${
                        selectedPersona.id === p.id
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                          : effectiveDark
                          ? 'hover:bg-slate-800'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs font-semibold">{p.name}</span>
                      <span className="text-[11px] text-slate-400">{p.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={createNewChat}
              aria-label="New chat"
              className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Missing-key banner */}
        {!apiKey && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs sm:text-sm text-amber-300">
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 shrink-0" />
              App chalane ke liye apni free Gemini API key add karein.
            </span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:opacity-95"
            >
              Add key
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto h-full">
            {activeSession.messages.length === 0 ? (
              <div className="min-h-[68vh] flex flex-col justify-center py-6">
                <div className="mb-8 space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Live Search • Image Studio • Voice</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                    <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                      Namaste, Dost!
                    </span>
                  </h1>
                  <p className={`text-lg sm:text-2xl font-medium ${effectiveDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Aaj main aapki kya madad kar sakta hoon?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {STARTER_PROMPTS.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (item.mode === 'image') {
                            setActiveMode('image');
                            handleSendMessage(item.prompt, 'image');
                          } else {
                            if (item.mode === 'search') setUseGoogleSearch(true);
                            setActiveMode('chat');
                            handleSendMessage(item.prompt, 'chat');
                          }
                        }}
                        className={`group text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-32 hover:-translate-y-0.5 ${
                          effectiveDark
                            ? 'bg-[#161b22]/90 hover:bg-[#1c232d] border-slate-800 hover:border-indigo-500/50'
                            : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-indigo-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-sm group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </span>
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-md`}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                        </div>
                        <p className={`text-xs line-clamp-2 ${effectiveDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-8">
                {activeSession.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-pink-500 flex items-center justify-center shrink-0 mt-1 shadow-md">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-br-sm shadow-md'
                          : effectiveDark
                          ? 'bg-[#161b22] border border-slate-800/90 text-slate-100 rounded-bl-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {msg.image && (
                        <div className="mb-3">
                          <img
                            src={msg.image}
                            alt="Uploaded attachment"
                            className="max-h-60 rounded-xl object-cover border border-white/20"
                          />
                        </div>
                      )}

                      {msg.role === 'user' ? (
                        <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      ) : (
                        <FormattedMessage
                          text={msg.text}
                          darkMode={effectiveDark}
                          onCopyCode={() => showToast('Code clipboard me copy ho gaya!')}
                        />
                      )}

                      {msg.generatedImage && (
                        <div className="mt-3 relative group rounded-2xl overflow-hidden border border-slate-700/60 shadow-xl">
                          <img src={msg.generatedImage} alt="AI generated" className="w-full max-h-[420px] object-cover" />
                          <a
                            href={msg.generatedImage}
                            download={`gimmi-ai-${msg.id}.png`}
                            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-medium backdrop-blur-md transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700/50">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                            <Globe className="w-3.5 h-3.5" />
                            <span>Search sources</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.slice(0, 4).map((src, i) => (
                              <a
                                key={i}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors max-w-[220px] ${
                                  effectiveDark
                                    ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300'
                                    : 'bg-slate-100 hover:bg-slate-200 text-indigo-700'
                                }`}
                              >
                                <span className="truncate">{src.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.role === 'model' && (
                        <div className="mt-3 pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/40">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePlayTTS(msg.id, msg.text)}
                              disabled={loadingAudioId === msg.id}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                                playingMsgId === msg.id ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800/60'
                              }`}
                              title="Read aloud"
                            >
                              {loadingAudioId === msg.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              ) : playingMsgId === msg.id ? (
                                <Square className="w-3.5 h-3.5 fill-current text-indigo-400" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {loadingAudioId === msg.id ? 'Loading...' : playingMsgId === msg.id ? 'Stop' : 'Suno'}
                              </span>
                            </button>

                            <button
                              onClick={async () => {
                                const ok = await copyTextToClipboard(msg.text);
                                showToast(ok ? 'Response copy ho gaya!' : 'Copy nahi ho paya.');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-800/60 transition-colors"
                              title="Copy response"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </button>
                          </div>
                          <span className="text-[11px] opacity-60">{msg.timestamp}</span>
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0 mt-1 text-slate-200">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isGenerating && (
                  <div className="flex gap-3.5 items-start">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-pink-500 flex items-center justify-center shrink-0 animate-pulse shadow-md">
                      <Sparkles className="w-4 h-4 text-white animate-spin" />
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3.5 w-64 space-y-2.5 border ${
                        effectiveDark ? 'bg-[#161b22] border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-medium text-indigo-400 flex items-center gap-2">
                        <span>{activeMode === 'image' ? 'Gimmi photo bana raha hai...' : 'Gimmi soch raha hai...'}</span>
                      </div>
                      <div className="h-2.5 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 rounded-full animate-pulse w-full" />
                      <div className="h-2.5 bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 rounded-full animate-pulse w-3/4" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="px-4 pb-4 pt-2 shrink-0 safe-bottom">
          <div className="max-w-3xl mx-auto">
            {uploadedImage && (
              <div className="mb-2 inline-flex items-center gap-2.5 p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
                <img src={uploadedImage.preview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                <div className="text-xs pr-1">
                  <p className="font-medium text-indigo-300 truncate max-w-[160px]">{uploadedImage.name}</p>
                  <p className="text-[10px] text-slate-400">Ready for vision analysis</p>
                </div>
                <button
                  onClick={() => setUploadedImage(null)}
                  aria-label="Remove image"
                  className="p-1 rounded-full hover:bg-rose-500/20 text-rose-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div
              className={`rounded-3xl border p-2.5 transition-all shadow-lg ${
                effectiveDark
                  ? 'bg-[#161b22] border-slate-700/80 focus-within:border-indigo-500/70'
                  : 'bg-white border-slate-300 focus-within:border-indigo-500'
              }`}
            >
              <div className="flex items-center gap-2 px-2 pb-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveMode('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                    activeMode === 'chat'
                      ? 'bg-indigo-600 text-white'
                      : effectiveDark
                      ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Smart Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode(activeMode === 'image' ? 'chat' : 'image')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                    activeMode === 'image'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : effectiveDark
                      ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Create Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                  aria-pressed={useGoogleSearch}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                    useGoogleSearch
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : effectiveDark
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                  title="Ground replies with live Google Search"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Google Search: {useGoogleSearch ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="flex items-end gap-2 px-1">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload photo"
                  className={`p-2.5 rounded-2xl transition-colors shrink-0 ${
                    effectiveDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <ImageIcon className="w-5 h-5 text-indigo-400" />
                </button>

                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    activeMode === 'image'
                      ? 'Kaisi photo banani hai describe karein (e.g., Futuristic Taj Mahal)...'
                      : 'Gimmi se kuch bhi puchein (Hindi, Hinglish ya English)...'
                  }
                  className="w-full bg-transparent resize-none outline-none py-2 px-1 text-sm sm:text-base max-h-32 overflow-y-auto"
                />

                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  className={`p-2.5 rounded-2xl transition-all shrink-0 ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : effectiveDark
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="Speak in Hindi / Hinglish / English"
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={(!input.trim() && !uploadedImage) || isGenerating}
                  aria-label="Send message"
                  className={`p-2.5 rounded-2xl transition-all shrink-0 ${
                    (input.trim() || uploadedImage) && !isGenerating
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md hover:opacity-95'
                      : effectiveDark
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-500 mt-2">
              Gimmi AI aapki bhasha (Hinglish, Hindi, English) samajhta hai • Aapki apni API key se chalta hai
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
