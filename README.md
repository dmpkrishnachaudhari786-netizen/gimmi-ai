# Gimmi AI

A warm, smart AI assistant that speaks **Hinglish, Hindi and English** — a Gemini-style
chat app you can install on your phone. Built from a single-file React component into a
real, production-quality progressive web app.

**Live app:** https://dmpkrishnachaudhari786-netizen.github.io/gimmi-ai/

## What it does

- **Smart chat** in Hindi / Hinglish / English, with markdown replies (headings, lists, code blocks with copy).
- **Create Image** — text-to-image generation (Nano Banana family) with a one-tap download.
- **Live search grounding** — toggle Google Search on and answers come back with real source links.
- **Vision** — attach a photo and ask about it.
- **Read aloud** — Gemini TTS reads any reply in a choice of voices.
- **Voice input** — speak in Hindi/Hinglish/English (browser Speech Recognition).
- **4 AI personas** — Smart, Coding Guru, Desi Dost, Study Coach.
- **Chats are saved** locally, dark/light theme, and the whole app installs as a PWA and works offline.

## Add your API key (one time)

Gimmi AI runs entirely in your browser with **your own** Google AI Studio key — nothing is
sent to any server but Google's.

1. Get a free key at <https://aistudio.google.com/app/apikey>.
2. Open the app, tap **API Key & Models** in the sidebar, paste the key, tap **Key test karo**.
3. Done. The key is stored only in your browser's localStorage.

You can also change the chat / image / TTS model names in the same panel if Google
retires a model.

## Run it locally

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build -> dist/
npm run preview    # serve the built app
```

## Deploy

The build is a plain static site, so it works on GitHub Pages, Netlify, Cloudflare Pages
or any static host. `npm run build` then publish the `dist/` folder.

## Tech

React 18 · Tailwind CSS · lucide-react · esbuild + Tailwind CLI build · PWA (manifest +
service worker). No backend.

## Notes / limits

- You need your own Gemini API key; the app has no bundled key.
- Image generation, TTS and Search grounding depend on your key's quota and on the models
  being available to it.
- Voice input needs a browser that supports the Web Speech API (Chrome/Edge/Safari).
