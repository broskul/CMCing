import { NextResponse } from 'next/server';
import { deleteVisita, getVisita, updateVisita } from '../../../lib/cmms-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const visita = await getVisita(id);
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }
    return NextResponse.json(visita);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const visita = await updateVisita(id, body);
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }
    return NextResponse.json(visita);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteVisita(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Visita deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
