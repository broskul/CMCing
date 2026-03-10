import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        equipos: true,
        visitas: true,
      },
    });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }
    return NextResponse.json(cliente);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const cliente = await prisma.cliente.update({
      where: { id: parseInt(params.id) },
      data: body,
    });
    return NextResponse.json(cliente);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.cliente.delete({
      where: { id: parseInt(params.id) },
    });
    return NextResponse.json({ message: 'Cliente deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}