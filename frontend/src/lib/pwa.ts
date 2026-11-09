import { useEffect, useState } from 'react';

/** Registers the service worker in production builds only (dev uses Vite HMR). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is a bonus, never fatal */ });
  });
}

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((l) => l()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Android/desktop Chrome install prompt; iOS has no prompt (Share → Add to Home Screen). */
export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return {
    canPrompt: !!deferred,
    installed: isStandalone(),
    ios: isIOS(),
    prompt: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      force((n) => n + 1);
      return outcome === 'accepted';
    },
  };
}

/** Shows a notification through the service worker when available (needed on Android), else the Notification API. */
export async function showSystemNotification(title: string, body: string, tag: string, url?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (reg?.active) reg.active.postMessage({ type: 'notify', title, body, tag, url });
  else new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
}
