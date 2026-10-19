import { Compass, Wand2, Code, Lightbulb } from 'lucide-react';

/**
 * The AI personalities the user can switch between. The instruction text is
 * sent to Gemini as the systemInstruction, so each one really changes behaviour.
 */
export const PERSONAS = [
  {
    id: 'default',
    name: 'Gimmi Smart (Default)',
    desc: 'Hinglish, Hindi aur English me smart aur friendly jawab',
    instruction:
      'You are Gimmi AI, a brilliant, warm, and helpful AI assistant. Respond naturally in the same language or style the user uses (including Hinglish, Hindi, or English). Use clear formatting, bullet points, and helpful examples. Be concise unless depth is asked for.'
  },
  {
    id: 'coder',
    name: 'Coding Guru',
    desc: 'Clean code, debugging aur architecture expert',
    instruction:
      'You are Gimmi Coding Guru, a senior full-stack software engineer. Provide clean, well-commented code examples, explain logic clearly in English or Hinglish as requested, and highlight best practices and common pitfalls. Always wrap code in fenced code blocks with the language tag.'
  },
  {
    id: 'dost',
    name: 'Desi Dost',
    desc: 'Ekdum friendly Hinglish me baat karne wala dost',
    instruction:
      'You are Gimmi Dost, a super friendly, witty, and supportive Indian friend who speaks natural Hinglish. Keep explanations fun, relatable, and easy to understand while remaining accurate and helpful.'
  },
  {
    id: 'teacher',
    name: 'Study Coach',
    desc: 'Har mushkil topic ko aasaan bhasha me samjhaye',
    instruction:
      'You are Gimmi Study Coach. Break down complex concepts into simple step-by-step explanations with real-life analogies, and end with two short quiz questions to check understanding.'
  }
];

/**
 * Home-screen suggestion cards. Each one triggers a real request.
 */
export const STARTER_PROMPTS = [
  {
    title: 'Mera Workout & Diet Plan',
    prompt:
      'Ghar par bina gym equipment ke 30 minute ka daily fitness aur vegetarian diet plan bana ke do.',
    icon: Compass,
    mode: 'chat',
    color: 'from-blue-500 to-cyan-400'
  },
  {
    title: 'AI Image Generate Karo',
    prompt:
      'A futuristic cyberpunk street in Mumbai during monsoon night with glowing neon Hindi signboards, 3D digital art',
    icon: Wand2,
    mode: 'image',
    color: 'from-purple-500 to-pink-500'
  },
  {
    title: 'Website Code Likho',
    prompt:
      'Mujhe HTML, CSS aur JS me ek modern Weather Card component ka code likh ke do aur samjhao.',
    icon: Code,
    mode: 'chat',
    color: 'from-amber-500 to-orange-500'
  },
  {
    title: 'Latest Tech & Space News',
    prompt:
      'Aaj kal AI aur Space exploration ki duniya me sabse badi nayi khoj aur updates kya hain? Search karke batao.',
    icon: Lightbulb,
    mode: 'search',
    color: 'from-emerald-500 to-teal-400'
  }
];

/**
 * Model defaults, kept in one place and editable from the in-app Settings panel
 * so the app keeps working as Google rolls models forward.
 */
export const DEFAULT_MODELS = {
  chat: 'gemini-3.8-flash',
  image: 'gemini-nano-banana-2.1',
  tts: 'gemini-2.5-flash-preview-tts'
};

export const MODEL_PRESETS = {
  chat: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  image: ['gemini-nano-banana-2.1', 'gemini-2.5-flash-image', 'gemini-3.1-flash-image'],
  tts: ['gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts']
};

export const VOICES = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
  'Zephyr'
];

export const STORAGE_KEYS = {
  apiKey: 'gimmi.apiKey',
  sessions: 'gimmi.sessions',
  prefs: 'gimmi.prefs'
};
