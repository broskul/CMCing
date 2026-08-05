'use client';

import { useEffect } from 'react';
import {
  getActiveOfflineUser,
  initializeOfflineStorage,
  purgeCurrentOfflineUser,
  refreshOfflineUserFromSession,
  setActiveOfflineUser,
} from './lib/offline';

const AUTH_CHANNEL = 'cmcing-offline-auth-v1';

export default function OfflineRegister() {
  useEffect(() => {
    let disposed = false;
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(AUTH_CHANNEL) : null;

    const postToActiveServiceWorker = async (message) => {
      if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active || navigator.serviceWorker.controller;
      worker?.postMessage(message);
    };

    const cacheTechnicianShell = () => postToActiveServiceWorker({ type: 'CACHE_TECHNICIAN_SHELL' })
      .catch((error) => console.warn('No se pudo preparar el shell offline del tecnico:', error));

    const clearTechnicianShell = () => postToActiveServiceWorker({ type: 'CLEAR_TECHNICIAN_SHELL' })
      .catch((error) => console.warn('No se pudo limpiar el shell offline del tecnico:', error));

    const initializeUser = async () => {
      try {
        const previous = getActiveOfflineUser();
        const current = navigator.onLine
          ? await refreshOfflineUserFromSession()
          : previous;
        if (navigator.onLine && previous && !current) {
          await purgeCurrentOfflineUser();
          await clearTechnicianShell();
          return;
        }
        if (current && !disposed) {
          await initializeOfflineStorage(current);
          if (navigator.onLine) await cacheTechnicianShell();
        }
      } catch (error) {
        // A transport failure must not erase pending field work. A confirmed logout is handled separately.
        console.warn('No se pudo verificar la particion offline:', error);
      }
    };

    const purgeForLogout = async (broadcast = true) => {
      try {
        await purgeCurrentOfflineUser();
        await clearTechnicianShell();
        if (broadcast) channel?.postMessage({ type: 'LOGOUT' });
      } catch (error) {
        console.error('No se pudo purgar la informacion offline al cerrar sesion:', error);
      }
    };

    const onServiceWorkerMessage = (event) => {
      if (event.data?.type === 'CMCING_AUTH_LOGOUT') void purgeForLogout(true);
    };
    const onChannelMessage = (event) => {
      if (event.data?.type === 'LOGOUT') void purgeForLogout(false);
    };
    const onSetUser = (event) => {
      try {
        const user = setActiveOfflineUser(event.detail);
        void initializeOfflineStorage(user);
        if (navigator.onLine) void cacheTechnicianShell();
      } catch (error) {
        console.warn('No se pudo cambiar el usuario offline:', error);
      }
    };
    const onPurgeUser = () => void purgeForLogout(true);
    const onControllerChange = () => {
      if (!disposed && navigator.onLine) void initializeUser();
    };

    window.addEventListener('online', initializeUser);
    window.addEventListener('cmcing:offline-set-user', onSetUser);
    window.addEventListener('cmcing:offline-purge-user', onPurgeUser);
    channel?.addEventListener('message', onChannelMessage);
    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
    void initializeUser();

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.webmanifest';
      document.head.appendChild(manifest);
    }

    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((error) => console.warn('No se pudo registrar el service worker offline:', error));
    }

    return () => {
      disposed = true;
      window.removeEventListener('online', initializeUser);
      window.removeEventListener('cmcing:offline-set-user', onSetUser);
      window.removeEventListener('cmcing:offline-purge-user', onPurgeUser);
      channel?.removeEventListener('message', onChannelMessage);
      channel?.close();
      navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
