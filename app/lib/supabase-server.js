import { createClient } from '@supabase/supabase-js';

const SUPABASE_CACHE_KEY = '__cmcing_supabase_admin__';
const SUPABASE_KEY_ENV_NAMES = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
];

function cleanEnv(name) {
  return String(process.env[name] || '').trim();
}

function looksPlaceholder(value) {
  const normalized = value.toLowerCase();
  return !value
    || normalized.includes('...')
    || normalized.includes('your-')
    || normalized.includes('example')
    || normalized.includes('<')
    || normalized.includes('>');
}

function legacyJwtRole(value) {
  if (!value.startsWith('eyJ')) return '';
  const parts = value.split('.');
  if (parts.length !== 3) return '';

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return String(payload?.role || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function isServerSupabaseKey(value) {
  return value.startsWith('sb_secret_') || legacyJwtRole(value) === 'service_role';
}

function getSupabaseKey() {
  const entry = SUPABASE_KEY_ENV_NAMES
    .map((name) => ({ name, value: cleanEnv(name) }))
    .find(({ value }) => value);

  if (!entry || looksPlaceholder(entry.value)) {
    throw new Error('Falta una llave privada de servidor en SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!isServerSupabaseKey(entry.value)) {
    throw new Error(`La variable ${entry.name} no contiene una llave privada de servidor de Supabase.`);
  }

  return entry;
}

function getSupabaseConfig() {
  const url = cleanEnv('NEXT_PUBLIC_SUPABASE_URL') || cleanEnv('SUPABASE_URL');

  if (!url || looksPlaceholder(url)) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL real para conectar con Supabase.');
  }

  const { value: serverKey } = getSupabaseKey();

  return { url, serverKey };
}

export function getSupabaseAdmin() {
  const { url, serverKey } = getSupabaseConfig();

  if (!globalThis[SUPABASE_CACHE_KEY]) {
    globalThis[SUPABASE_CACHE_KEY] = createClient(url, serverKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'cmcing-server',
        },
      },
    });
  }

  return globalThis[SUPABASE_CACHE_KEY];
}

export function assertSupabaseResult(result) {
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}
