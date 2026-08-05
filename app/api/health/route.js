import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const deep = new URL(request.url).searchParams.get('deep') === '1';
  let database = 'not_checked';
  let status = 'ok';

  if (deep) {
    try {
      const { error } = await getSupabaseAdmin().from('Cliente').select('id', { count: 'exact', head: true });
      database = error ? 'unavailable' : 'ok';
      if (error) status = 'degraded';
    } catch {
      database = 'unavailable';
      status = 'degraded';
    }
  }

  return NextResponse.json({
    status,
    database,
    service: 'cmcing-cmms',
    revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local',
    timestamp: new Date().toISOString(),
  }, {
    status: status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
