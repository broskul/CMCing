import { NextResponse } from 'next/server';
import { createEntity, listEquipos } from '../../lib/supabase-store';

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
    const equipo = await createEntity('equipos', body);
    return NextResponse.json(equipo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
