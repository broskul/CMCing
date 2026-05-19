import { NextResponse } from 'next/server';
import { createEquipo, listEquipos } from '../../lib/cmms-store';

export async function GET() {
  try {
    return NextResponse.json(await listEquipos());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const equipo = await createEquipo(body);
    return NextResponse.json(equipo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
