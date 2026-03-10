import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const visitas = await prisma.visita.findMany({
      select: {
        id: true,
        fecha: true,
        descripcion: true,
        estado: true,
        clienteId: true,
        equipoId: true,
        tecnicoId: true,
        vendedorId: true,
        servicioId: true,
        cliente: {
          select: { id: true, nombre: true },
        },
        equipo: {
          select: { id: true, nombre: true },
        },
        tecnico: {
          select: { id: true, nombre: true },
        },
        vendedor: {
          select: { id: true, nombre: true },
        },
        servicio: {
          select: { id: true, descripcion: true },
        },
      },
    });
    return NextResponse.json(
      visitas.map(v => ({
        id: v.id,
        fecha: v.fecha,
        descripcion: v.descripcion,
        estado: v.estado,
        clienteId: v.clienteId,
        equipoId: v.equipoId,
        tecnicoId: v.tecnicoId,
        vendedorId: v.vendedorId,
        servicioId: v.servicioId,
        clienteNombre: v.cliente?.nombre || '-',
        equipoNombre: v.equipo?.nombre || '-',
        tecnicoNombre: v.tecnico?.nombre || '-',
        vendedorNombre: v.vendedor?.nombre || '-',
        servicioDescripcion: v.servicio?.descripcion || '-',
      }))
    );
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