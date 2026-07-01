import { NextResponse } from 'next/server';
import { createEntity, listActividades } from '../../lib/supabase-store';

export async function GET() {
  try {
    return NextResponse.json(await listActividades());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const actividad = await createEntity('actividades', body);
    return NextResponse.json(actividad, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
