import { NextResponse } from 'next/server';
import { resolveAppUser, safeNextPath } from '../../lib/auth';
import { createSupabaseServerClient } from '../../lib/supabase-auth-server';

function loginRedirect(request, code, next) {
  const loginUrl = new URL('/login', request.nextUrl.origin);
  loginUrl.searchParams.set('error', code);
  loginUrl.searchParams.set('next', next);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  if (!code) return loginRedirect(request, 'oauth_missing_code', next);

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return loginRedirect(request, 'oauth_exchange', next);

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      await supabase.auth.signOut({ scope: 'local' });
      return loginRedirect(request, 'oauth_identity', next);
    }

    const providers = Array.isArray(data.user.app_metadata?.providers)
      ? data.user.app_metadata.providers
      : [data.user.app_metadata?.provider].filter(Boolean);
    if (!providers.includes('azure')) {
      await supabase.auth.signOut({ scope: 'local' });
      return loginRedirect(request, 'oauth_identity', next);
    }

    try {
      await resolveAppUser(data.user, { touchLastLogin: true });
    } catch (profileError) {
      await supabase.auth.signOut({ scope: 'local' });
      const codeByReason = {
        AUTH_EMAIL_NOT_ALLOWED: 'email_not_allowed',
        AUTH_PROFILE_MISSING: 'profile_missing',
        AUTH_PROFILE_INACTIVE: 'profile_inactive',
        AUTH_PROFILE_CONFLICT: 'profile_conflict',
        AUTH_PROFILE_MISMATCH: 'profile_conflict',
      };
      return loginRedirect(request, codeByReason[profileError.code] || 'profile_error', next);
    }

    return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  } catch {
    return loginRedirect(request, 'auth_configuration', next);
  }
}
