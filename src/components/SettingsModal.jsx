import React, { useState } from 'react';
import { X, KeyRound, Loader2, CheckCircle2, AlertCircle, ExternalLink, Cpu, Mic2 } from 'lucide-react';
import { MODEL_PRESETS, VOICES } from '../lib/constants.js';
import { API_BASE, friendlyError } from '../lib/gemini.js';

/**
 * Settings panel: API key, model choices and TTS voice.
 * The key lives only in this browser's localStorage - it is never hardcoded
 * and never sent anywhere except Google's own API.
 */
export default function SettingsModal({ darkMode, initial, onSave, onClose }) {
  const [apiKey, setApiKey] = useState(initial.apiKey || '');
  const [models, setModels] = useState(initial.models);
  const [voice, setVoice] = useState(initial.voice);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }

  const updateModel = (key, value) => setModels((prev) => ({ ...prev, [key]: value }));

  const testKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, message: 'Pehle apni API key paste karein.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const url = `${API_BASE}/${models.chat}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] })
      });
      if (res.ok) {
        setTestResult({ ok: true, message: 'Key kaam kar rahi hai! Sab features ready hain.' });
      } else {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data?.error?.message || `Status ${res.status}`);
        err.status = res.status;
        setTestResult({ ok: false, message: friendlyError(err) });
      }
    } catch (e) {
      setTestResult({ ok: false, message: friendlyError(e) });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    onSave({ apiKey: apiKey.trim(), models, voice });
    onClose();
  };

  const inputCls = `w-full px-3 py-2 rounded-xl text-sm outline-none border transition-colors ${
    darkMode
      ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-indigo-500'
      : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'
  }`;

  const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border shadow-2xl animate-rise ${
          darkMode ? 'bg-[#161b22] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-700/40 bg-inherit">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-lg">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* API key */}
          <section>
            <label className={labelCls} htmlFor="gimmi-key">
              Google AI Studio API Key
            </label>
            <input
              id="gimmi-key"
              type="password"
              autoComplete="off"
              spellCheck="false"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Ye key sirf aapke is browser me (localStorage) save hoti hai aur seedha Google ke API ko
              bheji jaati hai. Kisi server par nahi jaati.{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                Free key banao <ExternalLink className="w-3 h-3" />
              </a>
            </p>

            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={testKey}
                disabled={testing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:opacity-95 disabled:opacity-60"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Key test karo
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-3 flex items-start gap-2 text-xs rounded-xl px-3 py-2 ${
                  testResult.ok
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </section>

          {/* Models */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-sm">Models</h3>
            </div>
            {[
              { key: 'chat', label: 'Chat / Vision model' },
              { key: 'image', label: 'Image generation model' }
            ].map(({ key, label }) => (
              <div key={key}>
                <label className={labelCls} htmlFor={`model-${key}`}>
                  {label}
                </label>
                <input
                  id={`model-${key}`}
                  list={`preset-${key}`}
                  value={models[key]}
                  onChange={(e) => updateModel(key, e.target.value)}
                  className={inputCls}
                />
                <datalist id={`preset-${key}`}>
                  {MODEL_PRESETS[key].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            ))}
          </section>

          {/* Voice */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-sm">Read-aloud voice</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor="voice-name">
                  Voice
                </label>
                <select
                  id="voice-name"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className={inputCls}
                >
                  {VOICES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="tts-model">
                  TTS model
                </label>
                <input
                  id="tts-model"
                  list="preset-tts"
                  value={models.tts}
                  onChange={(e) => updateModel('tts', e.target.value)}
                  className={inputCls}
                />
                <datalist id="preset-tts">
                  {MODEL_PRESETS.tts.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${
                darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
