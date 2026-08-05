import { NextResponse } from 'next/server';
import { isAllowedAuthEmail } from '../../../lib/auth';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';

const GENERIC_MESSAGE = 'Si el correo corresponde a una cuenta CMCing habilitada, recibirás instrucciones para definir una nueva contraseña.';

function response(message = GENERIC_MESSAGE, status = 200) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

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
    return NextResponse.json({ error: 'Solicitud de recuperación inválida.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return response();

  // Supabase sólo entrega el enlace a identidades existentes. La respuesta se
  // mantiene idéntica para no revelar si el correo existe y no se permite alta
  // de cuentas desde este flujo.
  if (!isAllowedAuthEmail(email)) return response();

  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = new URL('/auth/confirm', request.nextUrl.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return response();
  } catch {
    return response('No fue posible procesar la solicitud en este momento. Inténtalo nuevamente.', 503);
  }
}
