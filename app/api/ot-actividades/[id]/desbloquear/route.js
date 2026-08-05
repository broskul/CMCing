import { NextResponse } from 'next/server';
import { routeError } from '../../../../lib/api-response';
import { requireRequestRole } from '../../../../lib/request-auth';
import { unlockActividadTrabajo } from '../../../../lib/service-work-store';

export async function POST(request, { params }) {
  try {
    const admin = await requireRequestRole(request, ['ADMIN', 'SUPERADMIN']);
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await unlockActividadTrabajo(id, body.motivo, admin));
  } catch (error) {
    return routeError(error);
  }
}
