import { NextResponse } from 'next/server';
import { createEmpleado, listEmpleados } from '../../lib/cmms-store';

export async function GET() {
  try {
    return NextResponse.json(await listEmpleados());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const empleado = await createEmpleado(body);
    return NextResponse.json(empleado, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
