import { NextResponse } from 'next/server';
import { getDashboardStats } from '../../lib/supabase-store';
import { getServiceWorkDashboardStats } from '../../lib/service-work-store';

export async function GET() {
  try {
    const [legacy, serviceWork] = await Promise.all([
      getDashboardStats(),
      getServiceWorkDashboardStats().catch(() => ({
        ordenesTrabajo: 0,
        actividadesAbiertas: 0,
        actividadesCerradas: 0,
        matrices: 0,
      })),
    ]);
    const response = NextResponse.json({ ...legacy, ...serviceWork });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
