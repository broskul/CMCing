const CACHE_PREFIX = 'cmcing-static-';
const CACHE_NAME = `${CACHE_PREFIX}v6`;
const TECHNICIAN_SHELL_KEY = '/__cmcing/offline/technician-shell-v1';
const SAFE_SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/brand/logo-cmcing.png',
];

function isSafeStaticPath(pathname) {
  return pathname.startsWith('/_next/static/')
    || pathname.startsWith('/brand/')
    || pathname.startsWith('/productos/')
    || pathname === '/favicon.ico'
    || pathname === '/manifest.webmanifest';
}

function isTechnicianPath(pathname) {
  return pathname.replace(/\/$/, '') === '/tecnico';
}

async function cacheSafeAssetsFromHtml(html, cache) {
  const assetUrls = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], self.location.origin);
      if (url.origin === self.location.origin && isSafeStaticPath(url.pathname)) assetUrls.add(url.href);
    } catch {
      // Ignore malformed or non-URL attributes from the document.
    }
  }

  await Promise.allSettled([...assetUrls].map(async (assetUrl) => {
    const request = new Request(assetUrl, { credentials: 'same-origin', cache: 'reload' });
    const response = await fetch(request);
    const cacheControl = response.headers.get('Cache-Control') || '';
    if (response.ok && response.type === 'basic' && !/no-store|private/i.test(cacheControl)) {
      await cache.put(request, response);
    }
  }));
}

async function cacheTechnicianShell() {
  const response = await fetch(new Request('/tecnico?__cmcing_offline_shell=v1', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'reload',
    headers: { Accept: 'text/html' },
  }));
  const finalUrl = new URL(response.url, self.location.origin);
  const contentType = response.headers.get('Content-Type') || '';
  if (!response.ok
    || finalUrl.origin !== self.location.origin
    || !isTechnicianPath(finalUrl.pathname)
    || !contentType.toLowerCase().includes('text/html')) {
    throw new Error('La sesion autenticada no entrego el shell del tecnico.');
  }

  const html = await response.text();
  const headers = new Headers(response.headers);
  ['content-encoding', 'content-length', 'set-cookie', 'transfer-encoding'].forEach((name) => headers.delete(name));
  headers.set('Cache-Control', 'no-store');
  headers.set('X-CMCing-Offline-Shell', '1');

  const cache = await caches.open(CACHE_NAME);
  await cache.put(TECHNICIAN_SHELL_KEY, new Response(html, {
    status: 200,
    statusText: 'OK',
    headers,
  }));
  await cacheSafeAssetsFromHtml(html, cache);
}

async function clearTechnicianShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(TECHNICIAN_SHELL_KEY);
}

async function handleNavigation(request, url) {
  try {
    return await fetch(request);
  } catch {
    if (isTechnicianPath(url.pathname)) {
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match(TECHNICIAN_SHELL_KEY);
      if (shell) return shell;
    }
    return offlineNavigationResponse();
  }
}

function offlineNavigationResponse() {
  return new Response(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#102a43"><title>CMCing · Sin conexión</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fa;color:#102a43;font:16px system-ui,sans-serif}main{max-width:30rem;margin:2rem;padding:2rem;border-radius:1rem;background:#fff;box-shadow:0 18px 55px #102a431a;text-align:center}img{width:min(15rem,70%);height:auto}h1{font-size:1.35rem}p{line-height:1.55;color:#52667a}a{display:inline-block;border-radius:.75rem;padding:.8rem 1rem;background:#0b7285;color:#fff;font-weight:700;text-decoration:none}</style></head>
<body><main><img src="/brand/logo-cmcing.png" alt="CMCing"><h1>Sin conexión</h1><p>La información de terreno ya abierta permanece guardada en este dispositivo. Recupera la conexión para volver a ingresar o sincronizar.</p><a href="">Reintentar</a></main></body></html>`, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; navigate-to 'self'",
    },
  });
}

async function notifyLogout() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'CMCING_AUTH_LOGOUT' });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SAFE_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_TECHNICIAN_SHELL') {
    event.waitUntil(cacheTechnicianShell().catch((error) => {
      console.warn('No se pudo preparar el shell offline del tecnico:', error);
    }));
  }
  if (event.data?.type === 'CLEAR_TECHNICIAN_SHELL') {
    event.waitUntil(clearTechnicianShell());
  }
  if (event.data?.type === 'CLEAR_STATIC_CACHE') {
    event.waitUntil(caches.delete(CACHE_NAME)
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => cache.addAll(SAFE_SHELL_ASSETS)));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated APIs are always network-only. Logout is merely observed so every tab purges IndexedDB.
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      event.respondWith(fetch(request).then(async (response) => {
        if (response.ok) await notifyLogout();
        return response;
      }));
    }
    return;
  }

  // Navigations remain network-first. Only the user-neutral technician shell can be used offline.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (request.method !== 'GET' || !isSafeStaticPath(url.pathname)) return;

  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request, { ignoreVary: false });
    if (cached) return cached;
    const response = await fetch(request);
    const cacheControl = response.headers.get('Cache-Control') || '';
    if (response.ok && response.type === 'basic' && !/no-store|private/i.test(cacheControl)) {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  }));
});
