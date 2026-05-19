import { NextResponse } from 'next/server';
import { createVisita, listVisitas } from '../../lib/cmms-store';

export async function GET() {
  try {
    return NextResponse.json(await listVisitas());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const visita = await createVisita(body);
    return NextResponse.json(visita, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
