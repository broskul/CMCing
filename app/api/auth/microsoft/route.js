import { NextResponse } from 'next/server';
import { safeNextPath } from '../../../lib/auth';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';

export async function GET(request) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  try {
    const supabase = await createSupabaseServerClient();
    const callbackUrl = new URL('/auth/callback', request.nextUrl.origin);
    callbackUrl.searchParams.set('next', next);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: callbackUrl.toString(),
        scopes: 'email',
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error || !data.url) {
      const loginUrl = new URL('/login', request.nextUrl.origin);
      loginUrl.searchParams.set('error', 'microsoft_unavailable');
      loginUrl.searchParams.set('next', next);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(data.url);
  } catch {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('error', 'auth_configuration');
    loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl);
  }
}
