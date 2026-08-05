import { NextResponse } from 'next/server';
import { deleteClienteContacto, updateClienteContacto } from '../../../../../lib/supabase-store';

export async function PUT(request, { params }) {
  try {
    const { id, contactoId } = await params;
    const contacto = await updateClienteContacto(id, contactoId, await request.json());
    if (!contacto) return NextResponse.json({ error: 'Contacto not found' }, { status: 404 });
    return NextResponse.json(contacto);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, contactoId } = await params;
    await deleteClienteContacto(id, contactoId);
    return NextResponse.json({ message: 'Contacto deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
