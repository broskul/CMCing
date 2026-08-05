import { NextResponse } from 'next/server';
import { assertActivityAccess } from '../../../lib/activity-access';
import { routeError } from '../../../lib/api-response';
import { requireRequestRole, requireRequestUser } from '../../../lib/request-auth';
import { getActividadTrabajo, updateActividadTrabajo } from '../../../lib/service-work-store';

export async function GET(_request, { params }) {
  try {
    const user = await requireRequestUser(_request);
    const { id } = await params;
    const activity = await getActividadTrabajo(id);
    if (!activity) return NextResponse.json({ error: 'Actividad no encontrada.' }, { status: 404 });
    assertActivityAccess(user, activity);
    return NextResponse.json(activity);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireRequestRole(request, ['ADMIN', 'OPERACIONES']);
    const { id } = await params;
    const activity = await getActividadTrabajo(id);
    assertActivityAccess(user, activity, { write: true });
    return NextResponse.json(await updateActividadTrabajo(id, await request.json(), user));
  } catch (error) {
    return routeError(error);
  }
}
