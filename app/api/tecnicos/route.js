import { NextResponse } from 'next/server';
import { createEntity, listTecnicos } from '../../lib/demo-store';

export async function GET() {
  try {
    return NextResponse.json(listTecnicos());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tecnico = createEntity('tecnicos', body);
    return NextResponse.json(tecnico, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
