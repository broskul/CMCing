'use client';

import { createBrowserClient } from '@supabase/ssr';

let browserClient;

function getBrowserConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || ''
  ).trim();

  if (!url || !key) {
    throw new Error('Falta configurar Supabase para el navegador.');
  }

  return { url, key };
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, key } = getBrowserConfig();
    browserClient = createBrowserClient(url, key);
  }

  return browserClient;
}
