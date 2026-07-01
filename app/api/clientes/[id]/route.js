import { NextResponse } from 'next/server';
import { deleteEntity, getCliente, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cliente = await getCliente(id);
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }
    return NextResponse.json(cliente);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cliente = await updateEntity('clientes', id, body);
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }
    return NextResponse.json(cliente);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteEntity('clientes', id);
    if (!deleted) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Cliente deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
