import { NextResponse } from 'next/server';
import { createIncidente, listIncidentes } from '../../lib/cmms-store';

export async function GET() {
  try {
    return NextResponse.json(await listIncidentes());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const incidente = await createIncidente(body);
    return NextResponse.json(incidente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
