import { NextResponse } from 'next/server';
import { isAllowedAuthEmail, resolveAppUser } from '../../../lib/auth';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';

export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Origen de solicitud no autorizado.' }, { status: 403 });
  }

  if (!String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'El contenido debe enviarse como JSON.' }, { status: 415 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud de ingreso invalida.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return NextResponse.json({ error: 'Ingrese correo y contraseña.' }, { status: 400 });
  }

  if (!isAllowedAuthEmail(email)) {
    return NextResponse.json({ error: 'Usuario o contraseña invalidos.' }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: 'Usuario o contraseña invalidos.' }, { status: 401 });
    }

    try {
      const user = await resolveAppUser(data.user, { touchLastLogin: true });
      const response = NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set('cmcing_session', '', { path: '/', maxAge: 0 });
      return response;
    } catch (profileError) {
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.json(
        { error: profileError.message || 'La cuenta no esta habilitada en CMCing.' },
        { status: Number.isInteger(profileError.status) ? profileError.status : 403 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error?.code === 'AUTH_CONFIGURATION' ? error.message : 'No se pudo iniciar sesión.' },
      { status: Number.isInteger(error?.status) ? error.status : 500 }
    );
  }
}
