import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const vendedores = await prisma.vendedor.findMany({
      include: {
        visitas: true,
      },
    });
    return NextResponse.json(vendedores);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const vendedor = await prisma.vendedor.create({
      data: body,
    });
    return NextResponse.json(vendedor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}