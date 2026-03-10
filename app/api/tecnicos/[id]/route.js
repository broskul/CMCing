import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const tecnico = await prisma.tecnico.findUnique({
      where: { id: parseInt(params.id) },
      include: { visitas: true },
    });
    if (!tecnico) {
      return NextResponse.json({ error: 'Técnico not found' }, { status: 404 });
    }
    return NextResponse.json(tecnico);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const tecnico = await prisma.tecnico.update({
      where: { id: parseInt(params.id) },
      data: body,
    });
    return NextResponse.json(tecnico);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.tecnico.delete({
      where: { id: parseInt(params.id) },
    });
    return NextResponse.json({ message: 'Técnico deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}