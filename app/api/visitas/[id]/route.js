import { NextResponse } from 'next/server';
import { deleteEntity, getVisita, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const visita = await getVisita(params.id);
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
    const body = await request.json();
    const visita = await updateEntity('visitas', params.id, body);
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
    const deleted = await deleteEntity('visitas', params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Visita deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
