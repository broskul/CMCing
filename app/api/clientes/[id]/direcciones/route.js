import { NextResponse } from 'next/server';
import { createClienteDireccion, getCliente } from '../../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cliente = await getCliente(id);
    if (!cliente) return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    return NextResponse.json(cliente.direcciones || []);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const direccion = await createClienteDireccion(id, await request.json());
    return NextResponse.json(direccion, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
