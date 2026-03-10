import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const visitas = await prisma.visita.findMany({
      include: {
        cliente: true,
        equipo: true,
        tecnico: true,
        vendedor: true,
        servicio: true,
      },
    });
    return NextResponse.json(visitas);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const visita = await prisma.visita.create({
      data: body,
    });
    return NextResponse.json(visita, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}