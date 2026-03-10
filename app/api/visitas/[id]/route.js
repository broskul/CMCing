import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const visita = await prisma.visita.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        cliente: true,
        equipo: true,
        tecnico: true,
        vendedor: true,
        servicio: true,
      },
    });
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }
    return NextResponse.json(visita);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const visita = await prisma.visita.update({
      where: { id: parseInt(params.id) },
      data: body,
    });
    return NextResponse.json(visita);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.visita.delete({
      where: { id: parseInt(params.id) },
    });
    return NextResponse.json({ message: 'Visita deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}