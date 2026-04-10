import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const estado = searchParams.get('estado');
    const clienteId = searchParams.get('clienteId');

    const where = {};

    if (estado && estado !== 'todos') {
      where.estado = estado;
    }

    if (clienteId) {
      where.clienteId = Number(clienteId);
    }

    if (desde || hasta) {
      where.fecha = {};
      if (desde) {
        where.fecha.gte = new Date(desde);
      }
      if (hasta) {
        const endDate = new Date(hasta);
        endDate.setHours(23, 59, 59, 999);
        where.fecha.lte = endDate;
      }
    }

    const visitas = await prisma.visita.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        cliente: { select: { id: true, nombre: true } },
        equipo: { select: { id: true, nombre: true, serial: true } },
        tecnico: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        servicio: { select: { id: true, descripcion: true, precio: true } },
      },
    });

    return NextResponse.json({
      filtros: { desde, hasta, estado: estado || 'todos', clienteId },
      total: visitas.length,
      visitas,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
