import { NextResponse } from 'next/server';
import { deleteEntity, getConductor, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const conductor = await getConductor(id);
    if (!conductor) return NextResponse.json({ error: 'Conductor not found' }, { status: 404 });
    return NextResponse.json(conductor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const conductor = await updateEntity('conductores', id, await request.json());
    if (!conductor) return NextResponse.json({ error: 'Conductor not found' }, { status: 404 });
    return NextResponse.json(conductor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteEntity('conductores', id);
    if (!deleted) return NextResponse.json({ error: 'Conductor not found' }, { status: 404 });
    return NextResponse.json({ message: 'Conductor deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
