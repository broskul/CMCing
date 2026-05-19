import { NextResponse } from 'next/server';
import { createMantencion, listMantenciones } from '../../lib/cmms-store';

export async function GET() {
  try {
    return NextResponse.json(await listMantenciones());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const mantencion = await createMantencion(body);
    return NextResponse.json(mantencion, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
