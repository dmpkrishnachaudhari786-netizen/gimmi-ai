/**
 * Thin, dependency-free wrapper around the Google Gemini REST API.
 * All calls run in the browser with the user's own API key.
 */

export const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * POST to a Gemini endpoint, retrying transient failures (429 / 5xx) with
 * exponential backoff. Throws an Error carrying a human-readable message.
 */
export async function fetchWithBackoff(url, options, maxRetries = 3) {
  let delay = 900;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return await response.json();
      }

      // Parse the error body once; it holds the real reason (bad key, quota...).
      const errData = await response.json().catch(() => ({}));
      const message =
        errData?.error?.message || `Request failed with status ${response.status}`;

      // Non-retryable client errors: fail fast with the API's own message.
      if (response.status !== 429 && response.status < 500) {
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      lastError = new Error(message);
    } catch (error) {
      // Network / parse failures also get retried, unless it is the last try.
      if (error.status && error.status !== 429 && error.status < 500) throw error;
      lastError = error;
      if (attempt === maxRetries) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
  throw lastError || new Error('Unknown network error');
}

/** Decode a base64 string into an ArrayBuffer. */
export function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

/** Wrap raw 16-bit PCM samples in a WAV container so browsers can play them. */
export function pcmToWav(pcm16, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) view.setInt16(offset, pcm16[i], true);

  return new Blob([view], { type: 'audio/wav' });
}

/** Copy text to the clipboard, with a fallback for older mobile browsers. */
export async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
}

/** Turn an API error into a short, friendly, actionable sentence. */
export function friendlyError(error) {
  const raw = (error && error.message) || '';
  const status = error && error.status;

  if (status === 400 && /api key/i.test(raw)) {
    return 'API key valid nahi hai. Settings me apni Google AI Studio key dobara check karein.';
  }
  if (status === 403) {
    return 'Is key ke paas is model ka access nahi hai. Settings me doosra model try karein.';
  }
  if (status === 429) {
    return 'Free quota khatam ho gaya (rate limit). Thodi der baad dobara try karein.';
  }
  if (status === 404) {
    return 'Model name nahi mila. Settings me model ka naam theek karein.';
  }
  if (status >= 500) {
    return 'Google ke server me temporary dikkat hai. Kripya dobara koshish karein.';
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return 'Internet ya server se sampark nahi ho paya. Connection check karke dobara try karein.';
  }
  return raw || 'Kuch galat ho gaya. Kripya dobara koshish karein.';
}

/** Chat / vision request. Returns { text, sources }. */
export async function generateChat({ apiKey, model, contents, systemInstruction, useSearch }) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = { contents };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (useSearch) {
    payload.tools = [{ google_search: {} }];
  }

  const result = await fetchWithBackoff(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const candidate = result?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text =
    parts
      .map((p) => p?.text)
      .filter(Boolean)
      .join('\n') ||
    'Maaf kijiye, mujhe abhi response nahi mil paya. Kripya dobara koshish karein.';

  let sources = [];
  const gm = candidate?.groundingMetadata;
  const chunks =
    gm?.groundingChunks ||
    gm?.groundingAttributions?.map((a) => ({ web: a.web })) ||
    [];
  sources = chunks
    .map((c) => ({ uri: c?.web?.uri, title: c?.web?.title }))
    .filter((s) => s.uri && s.title);

  return { text, sources };
}

/** Text-to-image request. Returns a data: URL for the generated image. */
export async function generateImage({ apiKey, model, prompt }) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  };

  const result = await fetchWithBackoff(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const parts = result?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inlineData?.data);
  const textPart = parts.find((p) => p.text);

  if (!imgPart) {
    const reason = textPart?.text || 'Model ne koi image return nahi ki.';
    const err = new Error(reason);
    err.status = 422;
    throw err;
  }

  const mime = imgPart.inlineData.mimeType || 'image/png';
  return {
    imageUrl: `data:${mime};base64,${imgPart.inlineData.data}`,
    note: textPart?.text || ''
  };
}

/** Text-to-speech request. Returns an object URL for a playable WAV blob. */
export async function generateSpeech({ apiKey, model, voice, text }) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{ parts: [{ text: `Say in a warm, natural, conversational tone: ${text}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
    }
  };

  const result = await fetchWithBackoff(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const part = result?.candidates?.[0]?.content?.parts?.[0];
  const audioData = part?.inlineData?.data;
  const mimeType = part?.inlineData?.mimeType || 'audio/L16;rate=24000';

  if (!audioData) {
    const err = new Error('Audio generate nahi ho paya.');
    err.status = 422;
    throw err;
  }

  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const pcmBuffer = base64ToArrayBuffer(audioData);
  const pcm16 = new Int16Array(pcmBuffer);
  const wavBlob = pcmToWav(pcm16, sampleRate);
  return URL.createObjectURL(wavBlob);
}
