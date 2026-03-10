import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const vendedor = await prisma.vendedor.findUnique({
      where: { id: parseInt(params.id) },
      include: { visitas: true },
    });
    if (!vendedor) {
      return NextResponse.json({ error: 'Vendedor not found' }, { status: 404 });
    }
    return NextResponse.json(vendedor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const vendedor = await prisma.vendedor.update({
      where: { id: parseInt(params.id) },
      data: body,
    });
    return NextResponse.json(vendedor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.vendedor.delete({
      where: { id: parseInt(params.id) },
    });
    return NextResponse.json({ message: 'Vendedor deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}