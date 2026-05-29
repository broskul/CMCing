import { createClient } from '@supabase/supabase-js';

const SUPABASE_CACHE_KEY = '__cmcing_supabase_admin__';

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey.includes('...') || serviceRoleKey.length < 80) {
    throw new Error('Faltan variables Supabase reales: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceRoleKey };
}

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!globalThis[SUPABASE_CACHE_KEY]) {
    globalThis[SUPABASE_CACHE_KEY] = createClient(url, serviceRoleKey, {
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
