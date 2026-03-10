import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const tecnicos = await prisma.tecnico.findMany({
      include: {
        visitas: true,
      },
    });
    return NextResponse.json(tecnicos);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tecnico = await prisma.tecnico.create({
      data: body,
    });
    return NextResponse.json(tecnico, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}