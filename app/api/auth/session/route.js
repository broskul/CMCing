import { NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '../../../lib/auth';

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await getSession(token);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
