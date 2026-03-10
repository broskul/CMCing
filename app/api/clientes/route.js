import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        equipos: {
          select: {
            id: true,
            nombre: true,
            modelo: true,
            serial: true,
          },
        },
        visitas: {
          select: {
            id: true,
            fecha: true,
            descripcion: true,
            estado: true,
          },
        },
      },
    });
    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const cliente = await prisma.cliente.create({
      data: body,
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}