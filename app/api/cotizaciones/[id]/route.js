import { NextResponse } from 'next/server';
import { deleteEntity, getCotizacion, updateEntity } from '../../../lib/supabase-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cotizacion = await getCotizacion(id);
    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion not found' }, { status: 404 });
    }
    return NextResponse.json(cotizacion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cotizacion = await updateEntity('cotizaciones', id, body);
    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion not found' }, { status: 404 });
    }
    return NextResponse.json(cotizacion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteEntity('cotizaciones', id);
    if (!deleted) {
      return NextResponse.json({ error: 'Cotizacion not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Cotizacion deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
