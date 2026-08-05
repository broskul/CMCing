import { NextResponse } from 'next/server';
import { routeError } from '../../../lib/api-response';
import { getMatrizCumplimiento, updateMatrizCumplimiento } from '../../../lib/service-work-store';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const matriz = await getMatrizCumplimiento(id);
    if (!matriz) return NextResponse.json({ error: 'Matriz no encontrada.' }, { status: 404 });
    return NextResponse.json(matriz);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json(await updateMatrizCumplimiento(id, await request.json()));
  } catch (error) {
    return routeError(error);
  }
}
