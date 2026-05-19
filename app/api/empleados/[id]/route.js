import { NextResponse } from 'next/server';
import { deleteEmpleado, getEmpleado, updateEmpleado } from '../../../lib/cmms-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const empleado = await getEmpleado(id);
    if (!empleado) return NextResponse.json({ error: 'Empleado not found' }, { status: 404 });
    return NextResponse.json(empleado);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const empleado = await updateEmpleado(id, body);
    if (!empleado) return NextResponse.json({ error: 'Empleado not found' }, { status: 404 });
    return NextResponse.json(empleado);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteEmpleado(id);
    return NextResponse.json({ message: 'Empleado deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
