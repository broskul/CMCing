import { NextResponse } from 'next/server';
import { deleteEntity, getCliente, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const cliente = await getCliente(params.id);
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
    const body = await request.json();
    const cliente = await updateEntity('clientes', params.id, body);
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
    const deleted = await deleteEntity('clientes', params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Cliente deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
