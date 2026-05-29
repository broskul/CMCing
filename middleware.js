import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'cmcing_session';
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/favicon.ico',
  '/sw.js',
];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/brand/')
    || pathname.startsWith('/productos/');
}

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.MSGRAPH_CLIENT_SECRET
    || '';
}

function base64UrlEncode(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(padded);
}

async function signPayload(payload) {
  const secret = getSessionSecret();
  if (!secret) return '';

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

  return base64UrlEncode(new Uint8Array(signature));
}

async function hasValidSession(token) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return false;

    const expected = await signPayload(payload);
    if (!expected || expected.length !== signature.length || expected !== signature) return false;

    const session = JSON.parse(base64UrlDecode(payload));
    return Number(session.expiresAt || 0) > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !pathname.startsWith('/api/')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!hasSession && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\.).*)'],
};
