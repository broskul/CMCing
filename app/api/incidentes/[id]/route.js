import { NextResponse } from 'next/server';
import { deleteIncidente, getIncidente, updateIncidente } from '../../../lib/cmms-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const incidente = await getIncidente(id);
    if (!incidente) return NextResponse.json({ error: 'Incidente not found' }, { status: 404 });
    return NextResponse.json(incidente);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const incidente = await updateIncidente(id, body);
    if (!incidente) return NextResponse.json({ error: 'Incidente not found' }, { status: 404 });
    return NextResponse.json(incidente);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteIncidente(id);
    return NextResponse.json({ message: 'Incidente deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
