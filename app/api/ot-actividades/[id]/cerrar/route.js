import { NextResponse } from 'next/server';
import { assertActivityAccess } from '../../../../lib/activity-access';
import { routeError } from '../../../../lib/api-response';
import { requireRequestUser } from '../../../../lib/request-auth';
import { closeActividadTrabajo, getActividadTrabajo } from '../../../../lib/service-work-store';

export async function POST(request, { params }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await params;
    assertActivityAccess(user, await getActividadTrabajo(id), { write: true });
    return NextResponse.json(await closeActividadTrabajo(id, user));
  } catch (error) {
    return routeError(error);
  }
}
