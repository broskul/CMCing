import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const clientes = await prisma.cliente.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        direccion: true,
        _count: {
          select: {
            equipos: true,
            visitas: true,
          },
        },
      },
    });
    return NextResponse.json(
      clientes.map(c => ({
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        telefono: c.telefono,
        direccion: c.direccion,
        equiposCount: c._count.equipos,
        visitasCount: c._count.visitas,
      }))
    );
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