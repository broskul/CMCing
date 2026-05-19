import { NextResponse } from 'next/server';
import { deleteMantencion, getMantencion, updateMantencion } from '../../../lib/cmms-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const mantencion = await getMantencion(id);
    if (!mantencion) return NextResponse.json({ error: 'Mantencion not found' }, { status: 404 });
    return NextResponse.json(mantencion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const mantencion = await updateMantencion(id, body);
    if (!mantencion) return NextResponse.json({ error: 'Mantencion not found' }, { status: 404 });
    return NextResponse.json(mantencion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteMantencion(id);
    return NextResponse.json({ message: 'Mantencion deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
