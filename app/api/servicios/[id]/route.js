import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: parseInt(params.id) },
      include: { visitas: true },
    });
    if (!servicio) {
      return NextResponse.json({ error: 'Servicio not found' }, { status: 404 });
    }
    return NextResponse.json(servicio);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const servicio = await prisma.servicio.update({
      where: { id: parseInt(params.id) },
      data: body,
    });
    return NextResponse.json(servicio);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.servicio.delete({
      where: { id: parseInt(params.id) },
    });
    return NextResponse.json({ message: 'Servicio deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}