import { NextResponse } from 'next/server';
import { createSession, getCookieOptions, SESSION_COOKIE, validateCredentials } from '../../../lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await validateCredentials(body.email, body.password);

    if (!user) {
      return NextResponse.json({ error: 'Usuario o contraseña inválidos.' }, { status: 401 });
    }

    const session = createSession(user);
    const response = NextResponse.json({ user: session.user });
    response.cookies.set(SESSION_COOKIE, session.token, getCookieOptions(session.maxAge));

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
