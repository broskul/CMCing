import { NextResponse } from 'next/server';
import { createVendedor, listVendedores } from '../../lib/cmms-store';

export async function GET() {
  try {
    return NextResponse.json(await listVendedores());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const vendedor = await createVendedor(body);
    return NextResponse.json(vendedor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
