import { NextResponse } from 'next/server';
import { createEntity, listTecnicos } from '../../lib/supabase-store';

export async function GET() {
  try {
    return NextResponse.json(await listTecnicos());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tecnico = await createEntity('tecnicos', body);
    return NextResponse.json(tecnico, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
