import { useCallback, useEffect, useState } from 'react';

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true)) ||
  false;

export const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.MSStream;

/**
 * Drives the "Install app" experience:
 *  - captures Chrome/Edge's beforeinstallprompt so we can show our own button
 *  - reports when the app is already running installed (standalone)
 *  - falls back to per-platform manual instructions (iOS Safari, desktop)
 */
export default function useInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault(); // keep the event so our button can trigger it later
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return { available: false };
    try {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === 'accepted') {
        setDeferred(null);
        return { available: true, accepted: true };
      }
      return { available: true, accepted: false };
    } catch {
      return { available: true, accepted: false };
    }
  }, [deferred]);

  return {
    canInstall: !!deferred, // native prompt available right now
    installed,
    isIos: isIos(),
    promptInstall
  };
}
