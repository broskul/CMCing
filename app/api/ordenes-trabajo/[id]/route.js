import { NextResponse } from 'next/server';
import { routeError } from '../../../lib/api-response';
import { getOrdenTrabajo, updateOrdenTrabajo } from '../../../lib/service-work-store';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const orden = await getOrdenTrabajo(id);
    if (!orden) return NextResponse.json({ error: 'OT no encontrada.' }, { status: 404 });
    return NextResponse.json(orden);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json(await updateOrdenTrabajo(id, await request.json()));
  } catch (error) {
    return routeError(error);
  }
}
