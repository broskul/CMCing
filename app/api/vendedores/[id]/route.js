import { NextResponse } from 'next/server';
import { deleteEntity, getVendedor, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const vendedor = await getVendedor(id);
    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor not found' }, { status: 404 });
    }
    return NextResponse.json(vendedor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const vendedor = await updateEntity('vendedores', id, body);
    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor not found' }, { status: 404 });
    }
    return NextResponse.json(vendedor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteEntity('vendedores', id);
    if (!deleted) {
      return NextResponse.json({ error: 'Vendedor not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Vendedor deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
