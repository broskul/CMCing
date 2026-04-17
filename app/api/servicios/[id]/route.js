import { NextResponse } from 'next/server';
import { deleteEntity, getServicio, updateEntity } from '../../../lib/demo-store';

export async function GET(request, { params }) {
  try {
    const servicio = getServicio(params.id);
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
    const body = await request.json();
    const servicio = updateEntity('servicios', params.id, body);
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
    const deleted = deleteEntity('servicios', params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Servicio not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Servicio deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
