import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const equipo = await prisma.equipo.findUnique({
      where: { id: parseInt(params.id) },
      include: { cliente: true, visitas: true },
    });
    if (!equipo) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json(equipo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const equipo = await prisma.equipo.update({
      where: { id: parseInt(params.id) },
      data: body,
    });
    return NextResponse.json(equipo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.equipo.delete({
      where: { id: parseInt(params.id) },
    });
    return NextResponse.json({ message: 'Equipo deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}