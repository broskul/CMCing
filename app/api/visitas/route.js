import { NextResponse } from 'next/server';
import { createEntity, listVisitas } from '../../lib/demo-store';

export async function GET() {
  try {
    return NextResponse.json(listVisitas());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const visita = createEntity('visitas', body);
    return NextResponse.json(visita, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
