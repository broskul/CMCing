import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase-server';

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export const SESSION_COOKIE = 'cmcing_session';

function passwordHash(password, salt) {
  return crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
}

function stripSensitiveUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function timingSafeEqualHex(a, b) {
  const aBuffer = Buffer.from(a, 'hex');
  const bBuffer = Buffer.from(b, 'hex');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyPassword(password, storedHash) {
  const [scheme, salt, expected] = String(storedHash || '').split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;

  const received = passwordHash(password, salt);
  return timingSafeEqualHex(received, expected);
}

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.MSGRAPH_CLIENT_SECRET;
}

function sign(payload) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('Falta APP_SESSION_SECRET o SUPABASE_SERVICE_ROLE_KEY para firmar sesiones.');

  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

export async function validateCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from('Usuario')
    .select('id,nombre,email,passwordHash,rol,tecnicoId,activo')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user?.activo || !verifyPassword(password, user.passwordHash)) return null;

  await supabase
    .from('Usuario')
    .update({ lastLoginAt: new Date().toISOString() })
    .eq('id', user.id);

  return stripSensitiveUser(user);
}

export function createSession(user) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const safeUser = stripSensitiveUser(user);
  const payload = Buffer.from(JSON.stringify({
    user: safeUser,
    expiresAt,
    nonce: crypto.randomBytes(12).toString('base64url'),
  })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;

  return { token, user: safeUser, maxAge: SESSION_TTL_MS / 1000 };
}

export function getSession(token) {
  if (!token) return null;

  try {
    const [payload, signature] = String(token).split('.');
    if (!payload || !signature) return null;

    const expected = sign(payload);
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      return null;
    }

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function destroySession(token) {
  return Boolean(token);
}

export function getCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}
