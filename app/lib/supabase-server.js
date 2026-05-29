import { createClient } from '@supabase/supabase-js';

const SUPABASE_CACHE_KEY = '__cmcing_supabase_admin__';

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serverKey || serverKey.includes('...') || serverKey.length < 80) {
    throw new Error('Faltan variables Supabase reales: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

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
