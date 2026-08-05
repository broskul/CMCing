import { NextResponse } from 'next/server';
import { routeError } from '../../lib/api-response';
import { createEquipment } from '../../lib/equipment-service';
import { requireRequestRole, requireRequestUser } from '../../lib/request-auth';
import { listEquipos } from '../../lib/supabase-store';

export async function GET(request) {
  try {
    await requireRequestUser(request);
    return NextResponse.json(await listEquipos());
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const body = await request.json();
    const equipo = await createEquipment(body);
    return NextResponse.json(equipo, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
