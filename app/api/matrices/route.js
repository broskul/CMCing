import { NextResponse } from 'next/server';
import { routeError } from '../../lib/api-response';
import { requireRequestUser } from '../../lib/request-auth';
import { createMatrizCumplimiento, listMatricesCumplimiento } from '../../lib/service-work-store';

export async function GET() {
  try {
    return NextResponse.json(await listMatricesCumplimiento());
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  try {
    const user = await requireRequestUser(request);
    return NextResponse.json(await createMatrizCumplimiento(await request.json(), user), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
