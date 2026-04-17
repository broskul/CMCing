import { NextResponse } from 'next/server';
import { createEntity, listClientes } from '../../lib/demo-store';

export async function GET() {
  try {
    return NextResponse.json(listClientes());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const cliente = createEntity('clientes', body);
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
