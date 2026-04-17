import { NextResponse } from 'next/server';
import { deleteEntity, getVendedor, updateEntity } from '../../../lib/demo-store';

export async function GET(request, { params }) {
  try {
    const vendedor = getVendedor(params.id);
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
    const body = await request.json();
    const vendedor = updateEntity('vendedores', params.id, body);
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
    const deleted = deleteEntity('vendedores', params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Vendedor not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Vendedor deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
