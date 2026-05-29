import { NextResponse } from 'next/server';
import { destroySession, getCookieOptions, SESSION_COOKIE } from '../../../lib/auth';

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  destroySession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', getCookieOptions(0));

  return response;
}
