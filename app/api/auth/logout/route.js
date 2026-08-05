import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';

export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Origen de solicitud no autorizado.' }, { status: 403 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // La respuesta sigue siendo idempotente para permitir limpiar sesiones vencidas.
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  response.cookies.set('cmcing_session', '', { path: '/', maxAge: 0 });
  return response;
}
