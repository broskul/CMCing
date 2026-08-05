import { NextResponse } from 'next/server';
import { createEntity, listConductores } from '../../lib/supabase-store';

export async function GET() {
  try {
    return NextResponse.json(await listConductores());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const conductor = await createEntity('conductores', await request.json());
    return NextResponse.json(conductor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
