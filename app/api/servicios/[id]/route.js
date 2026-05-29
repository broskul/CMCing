import { NextResponse } from 'next/server';
import { deleteEntity, getServicio, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const servicio = await getServicio(id);
    if (!servicio) {
      return NextResponse.json({ error: 'Servicio not found' }, { status: 404 });
    }
    return NextResponse.json(servicio);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const servicio = await updateEntity('servicios', id, body);
    if (!servicio) {
      return NextResponse.json({ error: 'Servicio not found' }, { status: 404 });
    }
    return NextResponse.json(servicio);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteEntity('servicios', id);
    if (!deleted) {
      return NextResponse.json({ error: 'Servicio not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Servicio deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
