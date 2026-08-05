import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getAuthConfig() {
  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL
      || process.env.SUPABASE_URL
      || ''
  ).trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.SUPABASE_ANON_KEY
      || ''
  ).trim();

  if (!url || !key) {
    const error = new Error('Falta configurar la URL y la llave publica de Supabase Auth.');
    error.code = 'AUTH_CONFIGURATION';
    error.status = 503;
    throw error;
  }

  return { url, key };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getAuthConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Proxy/Route Handlers refresh them.
        }
      },
    },
  });
}
