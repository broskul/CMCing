'use client';

import { useEffect } from 'react';

export default function OfflineRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update();
    }).catch((error) => {
      console.warn('No se pudo registrar service worker offline:', error);
    });
  }, []);

  return null;
}
