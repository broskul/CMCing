import { NextResponse } from 'next/server';
import { createEntity, listServicios } from '../../lib/demo-store';

export async function GET() {
  try {
    return NextResponse.json(listServicios());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const servicio = createEntity('servicios', body);
    return NextResponse.json(servicio, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
