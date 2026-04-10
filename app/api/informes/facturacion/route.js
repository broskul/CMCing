import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const where = {};

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
      include: {
        cliente: { select: { id: true, nombre: true } },
        servicio: { select: { id: true, descripcion: true, precio: true } },
      },
    });

    const resumenPorServicio = {};
    const resumenPorCliente = {};

    let totalServicios = 0;
    let totalFacturado = 0;

    visitas.forEach((visita) => {
      const servicioNombre = visita.servicio?.descripcion || 'Servicio sin nombre';
      const clienteNombre = visita.cliente?.nombre || 'Cliente sin nombre';
      const monto = visita.servicio?.precio || 0;

      totalServicios += 1;
      totalFacturado += monto;

      if (!resumenPorServicio[servicioNombre]) {
        resumenPorServicio[servicioNombre] = { servicio: servicioNombre, cantidad: 0, total: 0 };
      }
      resumenPorServicio[servicioNombre].cantidad += 1;
      resumenPorServicio[servicioNombre].total += monto;

      if (!resumenPorCliente[clienteNombre]) {
        resumenPorCliente[clienteNombre] = { cliente: clienteNombre, cantidad: 0, total: 0 };
      }
      resumenPorCliente[clienteNombre].cantidad += 1;
      resumenPorCliente[clienteNombre].total += monto;
    });

    return NextResponse.json({
      filtros: { desde, hasta },
      totalServicios,
      totalFacturado,
      porServicio: Object.values(resumenPorServicio).sort((a, b) => b.total - a.total),
      porCliente: Object.values(resumenPorCliente).sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
