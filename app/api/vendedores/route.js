import { NextResponse } from 'next/server';
import { createEntity, listVendedores } from '../../lib/demo-store';

export async function GET() {
  try {
    return NextResponse.json(listVendedores());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const vendedor = createEntity('vendedores', body);
    return NextResponse.json(vendedor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
