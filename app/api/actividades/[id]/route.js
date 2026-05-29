import { NextResponse } from 'next/server';
import { deleteEntity, getActividad, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const actividad = await getActividad(id);
    if (!actividad) {
      return NextResponse.json({ error: 'Actividad not found' }, { status: 404 });
    }
    return NextResponse.json(actividad);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const actividad = await updateEntity('actividades', id, body);
    if (!actividad) {
      return NextResponse.json({ error: 'Actividad not found' }, { status: 404 });
    }
    return NextResponse.json(actividad);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteEntity('actividades', id);
    if (!deleted) {
      return NextResponse.json({ error: 'Actividad not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Actividad deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
