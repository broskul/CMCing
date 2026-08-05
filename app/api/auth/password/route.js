import { NextResponse } from 'next/server';
import { isPasswordAuthEmail, resolveAppUser } from '../../../lib/auth';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';

const MIN_PASSWORD_LENGTH = 12;

function passwordMeetsPolicy(password) {
  return password.length >= MIN_PASSWORD_LENGTH
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
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
    return NextResponse.json({ error: 'Solicitud de contraseña inválida.' }, { status: 400 });
  }

  const password = String(body?.password || '');
  const confirmPassword = String(body?.confirmPassword || '');
  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Las contraseñas no coinciden.' }, { status: 400 });
  }
  if (!passwordMeetsPolicy(password)) {
    return NextResponse.json({ error: 'Usa al menos 12 caracteres, con minúscula, mayúscula, número y símbolo.' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: 'El enlace de recuperación no está activo. Solicita uno nuevo.' }, { status: 401 });
    }

    if (!isPasswordAuthEmail(data.user.email)) {
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.json({ error: 'Las cuentas corporativas se administran con Microsoft 365.' }, { status: 403 });
    }

    await resolveAppUser(data.user);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      return NextResponse.json({ error: 'No fue posible actualizar la contraseña. Solicita un enlace nuevo e inténtalo nuevamente.' }, { status: 400 });
    }

    await supabase.auth.signOut({ scope: 'local' });
    return NextResponse.json(
      { message: 'Contraseña actualizada.' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'No fue posible actualizar la contraseña.' },
      { status: Number.isInteger(error?.status) ? error.status : 500 }
    );
  }
}
