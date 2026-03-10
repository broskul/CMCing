import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const [clientes, equipos, visitas] = await Promise.all([
      prisma.cliente.count(),
      prisma.equipo.count(),
      prisma.visita.count(),
    ]);

    const response = NextResponse.json({
      clientes,
      equipos,
      visitas,
    });
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}