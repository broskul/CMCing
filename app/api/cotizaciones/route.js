import { NextResponse } from 'next/server';
import { createEntity, listCotizaciones } from '../../lib/supabase-store';

export async function GET() {
  try {
    return NextResponse.json(await listCotizaciones());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const cotizacion = await createEntity('cotizaciones', body);
    return NextResponse.json(cotizacion, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
