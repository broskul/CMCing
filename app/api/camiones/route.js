import { NextResponse } from 'next/server';
import { routeError } from '../../lib/api-response';
import { requireRequestRole, requireRequestUser } from '../../lib/request-auth';
import { createEntity, listCamiones } from '../../lib/supabase-store';

const INTERNAL_ERROR = 'No fue posible procesar la solicitud de camiones.';

export async function GET(request) {
  try {
    await requireRequestUser(request);
    return NextResponse.json(await listCamiones());
  } catch (error) {
    return routeError(error, { internalMessage: INTERNAL_ERROR });
  }
}

export async function POST(request) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const camion = await createEntity('camiones', await request.json());
    return NextResponse.json(camion, { status: 201 });
  } catch (error) {
    return routeError(error, { internalMessage: INTERNAL_ERROR });
  }
}
