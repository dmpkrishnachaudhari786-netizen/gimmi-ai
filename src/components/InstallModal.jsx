import React from 'react';
import { X, Share, MoreVertical, Plus, MonitorDown, Smartphone } from 'lucide-react';

/**
 * Manual install instructions, shown when the browser has no native
 * install prompt (iOS Safari, desktop Firefox, etc.).
 */
export default function InstallModal({ darkMode, platform, onClose }) {
  const panel = darkMode ? 'bg-[#161b22] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  const Row = ({ icon, children }) => (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-indigo-400">{icon}</span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install Gimmi AI"
        className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl animate-rise ${panel}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
          <h2 className="font-bold text-lg">Gimmi AI install karein</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {platform === 'ios' ? (
            <>
              <p className={`text-sm ${muted}`}>iPhone / iPad (Safari) par:</p>
              <ol className="space-y-3">
                <Row icon={<Share className="w-4 h-4" />}>
                  Neeche <b>Share</b> button dabayein.
                </Row>
                <Row icon={<Plus className="w-4 h-4" />}>
                  <b>“Add to Home Screen”</b> chunein.
                </Row>
                <Row icon={<Smartphone className="w-4 h-4" />}>
                  Naam <b>Gimmi AI</b> rakh kar <b>Add</b> dabayein. App home screen par aa jayega.
                </Row>
              </ol>
            </>
          ) : platform === 'desktop' ? (
            <>
              <p className={`text-sm ${muted}`}>Computer (Chrome / Edge) par:</p>
              <ol className="space-y-3">
                <Row icon={<MonitorDown className="w-4 h-4" />}>
                  Address bar ke <b>right</b> taraf chhota <b>install</b> (⊕) icon dabayein.
                </Row>
                <Row icon={<MoreVertical className="w-4 h-4" />}>
                  Ya browser menu (⋮) → <b>“Install Gimmi AI”</b> chunein.
                </Row>
              </ol>
            </>
          ) : (
            <>
              <p className={`text-sm ${muted}`}>Android (Chrome) par:</p>
              <ol className="space-y-3">
                <Row icon={<MoreVertical className="w-4 h-4" />}>
                  Upar right corner me <b>⋮</b> menu kholein.
                </Row>
                <Row icon={<Plus className="w-4 h-4" />}>
                  <b>“Install app”</b> ya <b>“Add to Home screen”</b> chunein.
                </Row>
                <Row icon={<Smartphone className="w-4 h-4" />}>
                  <b>Install</b> confirm karein — app home screen par aa jayega.
                </Row>
              </ol>
            </>
          )}

          <p className={`text-xs ${muted} pt-1`}>
            Install karne ke baad Gimmi AI ek app ki tarah khulega — full screen, bina address bar, aur
            offline bhi chalega.
          </p>
        </div>
      </div>
    </div>
  );
}
