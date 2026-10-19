import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyTextToClipboard } from '../lib/gemini.js';

/**
 * Renders an assistant reply. Supports fenced code blocks (with copy),
 * headings, bullet and numbered lists, and inline **bold** / `code`.
 */
export default function FormattedMessage({ text, darkMode, onCopyCode }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  const handleCopy = async (code, idx) => {
    const ok = await copyTextToClipboard(code);
    if (!ok) return;
    setCopiedIndex(idx);
    if (onCopyCode) onCopyCode();
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderInlineText = (line) => {
    const tokens = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    return tokens.map((token, i) => {
      if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
        return (
          <strong key={i} className="font-semibold text-indigo-500 dark:text-indigo-300">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
        return (
          <code
            key={i}
            className={`px-1.5 py-0.5 rounded text-xs font-mono ${
              darkMode ? 'bg-slate-800 text-pink-300 border border-slate-700' : 'bg-slate-200 text-pink-700'
            }`}
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      // Wrap plain text in a keyed span to keep React's list rendering clean.
      return <React.Fragment key={i}>{token}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-3 leading-relaxed text-[15px]">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim() || '';
          const hasLang = /^[a-zA-Z0-9_+#-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'code';
          const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={index}
              className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 text-slate-100 my-3 shadow-lg"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                  {lang}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(codeContent, index)}
                  aria-label="Copy code"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = part.split('\n');
        return (
          <div key={index} className="space-y-1.5">
            {paragraphs.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lineIdx} className="h-1" />;

              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={lineIdx} className="text-base font-bold mt-3 mb-1">
                    {renderInlineText(trimmed.slice(4))}
                  </h3>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={lineIdx} className="text-lg font-bold mt-4 mb-1.5">
                    {renderInlineText(trimmed.slice(3))}
                  </h2>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={lineIdx} className="text-xl font-bold mt-4 mb-2">
                    {renderInlineText(trimmed.slice(2))}
                  </h1>
                );
              }
              if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                return (
                  <div key={lineIdx} className="flex items-start gap-2.5 pl-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="flex-1">{renderInlineText(trimmed.slice(2))}</span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+\.)\s(.*)$/);
                if (match) {
                  return (
                    <div key={lineIdx} className="flex items-start gap-2 pl-1">
                      <span className="font-semibold text-indigo-400 shrink-0">{match[1]}</span>
                      <span className="flex-1">{renderInlineText(match[2])}</span>
                    </div>
                  );
                }
              }

              return <p key={lineIdx}>{renderInlineText(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}
