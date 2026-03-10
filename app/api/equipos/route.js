import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const equipos = await prisma.equipo.findMany({
      include: {
        cliente: true,
        visitas: true,
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