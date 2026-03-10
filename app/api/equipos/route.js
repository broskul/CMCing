import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const equipos = await prisma.equipo.findMany({
      select: {
        id: true,
        nombre: true,
        modelo: true,
        serial: true,
        clienteId: true,
        cliente: {
          select: {
            id: true,
            nombre: true,
          },
        },
        _count: {
          select: {
            visitas: true,
          },
        },
      },
    });
    return NextResponse.json(equipos);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const equipo = await prisma.equipo.create({
      data: body,
    });
    return NextResponse.json(equipo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}