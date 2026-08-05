import { NextResponse } from 'next/server';
import { routeError } from '../../../../lib/api-response';
import { requireRequestUser } from '../../../../lib/request-auth';
import { addOrdenTrabajoActivity } from '../../../../lib/service-work-store';

export async function POST(request, { params }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await params;
    return NextResponse.json(await addOrdenTrabajoActivity(id, await request.json(), user), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
