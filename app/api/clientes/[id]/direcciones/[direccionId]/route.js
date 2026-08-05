import { NextResponse } from 'next/server';
import { deleteClienteDireccion, updateClienteDireccion } from '../../../../../lib/supabase-store';

export async function PUT(request, { params }) {
  try {
    const { id, direccionId } = await params;
    const direccion = await updateClienteDireccion(id, direccionId, await request.json());
    if (!direccion) return NextResponse.json({ error: 'Dirección not found' }, { status: 404 });
    return NextResponse.json(direccion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, direccionId } = await params;
    await deleteClienteDireccion(id, direccionId);
    return NextResponse.json({ message: 'Dirección deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
