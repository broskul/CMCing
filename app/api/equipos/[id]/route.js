import { NextResponse } from 'next/server';
import { routeError } from '../../../lib/api-response';
import { updateEquipment } from '../../../lib/equipment-service';
import { requireRequestRole, requireRequestUser } from '../../../lib/request-auth';
import { deleteEntity, getEquipo } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    await requireRequestUser(request);
    const { id } = await params;
    const equipo = await getEquipo(id);
    if (!equipo) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json(equipo);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const { id } = await params;
    const body = await request.json();
    const equipo = await updateEquipment(id, body);
    if (!equipo) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json(equipo);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const { id } = await params;
    const deleted = await deleteEntity('equipos', id);
    if (!deleted) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Equipo deleted' });
  } catch (error) {
    return routeError(error);
  }
}
