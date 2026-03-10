import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const servicios = await prisma.servicio.findMany({
      include: {
        visitas: true,
      },
    });
    return NextResponse.json(servicios);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const servicio = await prisma.servicio.create({
      data: body,
    });
    return NextResponse.json(servicio, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}