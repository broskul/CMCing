import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { isAllowedAuthEmail, resolveAppUser, safeNextPath } from './app/lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/auth/confirm',
  '/auth/update-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/microsoft',
  '/api/auth/password-reset',
  '/api/auth/password',
  '/api/health',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/sw.js',
];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/brand/')
    || pathname.startsWith('/productos/');
}

function getAuthConfig() {
  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL
      || process.env.SUPABASE_URL
      || ''
  ).trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.SUPABASE_ANON_KEY
      || ''
  ).trim();

  if (!url || !key) throw new Error('Supabase Auth no esta configurado.');
  return { url, key };
}

function copyResponseCookies(source, target) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function redirectToLogin(request, response, reason) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (reason) loginUrl.searchParams.set('error', reason);
  return copyResponseCookies(response, NextResponse.redirect(loginUrl));
}

const TECHNICIAN_API_PATTERNS = [
  /^\/api\/tecnico(?:\/|$)/,
  /^\/api\/ot-actividades\/\d+$/,
  /^\/api\/ot-actividades\/\d+\/(?:respuestas|cerrar|imagenes|pdf)$/,
  /^\/api\/ia\/notas-tecnico$/,
  /^\/api\/r2\/private$/,
];

function profileAccessDenied(request, profile) {
  const { pathname } = request.nextUrl;
  const role = String(profile?.rol || '').toUpperCase();
  const method = String(request.method || 'GET').toUpperCase();
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (pathname.startsWith('/api/')) {
    if (role === 'LECTURA' && !safeMethod) return true;
    if (role === 'TECNICO') {
      if (/^\/api\/ot-actividades\/\d+$/.test(pathname) && !safeMethod) return true;
      const allowedRoute = TECHNICIAN_API_PATTERNS.some((pattern) => pattern.test(pathname));
      if (!allowedRoute) return true;
    }
    if (!['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA', 'TECNICO'].includes(role)) return true;
    return false;
  }

  if (role === 'TECNICO' && pathname !== '/tecnico' && !pathname.startsWith('/tecnico/')) return true;
  return false;
}

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);

  try {
    const { url, key } = getAuthConfig();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    const authUser = error ? null : data.user;

    if (publicPath) {
      if (pathname === '/login' && authUser && isAllowedAuthEmail(authUser.email)) {
        try {
          await resolveAppUser(authUser);
          const destination = safeNextPath(request.nextUrl.searchParams.get('next'));
          return copyResponseCookies(response, NextResponse.redirect(new URL(destination, request.url)));
        } catch {
          return response;
        }
      }
      return response;
    }

    if (!authUser) {
      if (pathname.startsWith('/api/')) {
        return copyResponseCookies(
          response,
          NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        );
      }
      return redirectToLogin(request, response);
    }

    if (!isAllowedAuthEmail(authUser.email)) {
      if (pathname.startsWith('/api/')) {
        return copyResponseCookies(
          response,
          NextResponse.json({ error: 'Cuenta no autorizada.' }, { status: 403 })
        );
      }
      return redirectToLogin(request, response, 'email_not_allowed');
    }

    let profile;
    try {
      profile = await resolveAppUser(authUser);
    } catch (profileError) {
      if (pathname.startsWith('/api/')) {
        return copyResponseCookies(
          response,
          NextResponse.json(
            { error: profileError.message || 'Cuenta no habilitada.' },
            { status: Number.isInteger(profileError.status) ? profileError.status : 403 }
          )
        );
      }
      const reason = Number(profileError.status) >= 500 ? 'auth_configuration' : 'profile_required';
      return redirectToLogin(request, response, reason);
    }

    if (profileAccessDenied(request, profile)) {
      if (pathname.startsWith('/api/')) {
        return copyResponseCookies(
          response,
          NextResponse.json({ error: 'No tiene permisos para acceder a este recurso.' }, { status: 403 })
        );
      }
      return copyResponseCookies(response, NextResponse.redirect(new URL('/tecnico', request.url)));
    }

    return response;
  } catch {
    if (publicPath) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Autenticación no disponible.' }, { status: 503 });
    }
    return redirectToLogin(request, response, 'auth_configuration');
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)'],
};
