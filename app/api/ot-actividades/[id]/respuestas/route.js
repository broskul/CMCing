import { NextResponse } from 'next/server';
import { assertActivityAccess } from '../../../../lib/activity-access';
import { routeError } from '../../../../lib/api-response';
import { requireRequestUser } from '../../../../lib/request-auth';
import { getActividadTrabajo, saveActivityMatrixResponses } from '../../../../lib/service-work-store';

export async function PUT(request, { params }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await params;
    assertActivityAccess(user, await getActividadTrabajo(id), { write: true });
    return NextResponse.json(await saveActivityMatrixResponses(id, await request.json(), user));
  } catch (error) {
    return routeError(error);
  }
}
