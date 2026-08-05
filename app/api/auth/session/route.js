import { NextResponse } from 'next/server';
import { resolveAppUser } from '../../../lib/auth';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const user = await resolveAppUser(data.user);
    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { user: null, error: error.message || 'No se pudo validar la sesión.' },
      { status: Number.isInteger(error?.status) ? error.status : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
