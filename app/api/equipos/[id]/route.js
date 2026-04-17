import { NextResponse } from 'next/server';
import { deleteEntity, getEquipo, updateEntity } from '../../../lib/demo-store';

export async function GET(request, { params }) {
  try {
    const equipo = getEquipo(params.id);
    if (!equipo) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json(equipo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const equipo = updateEntity('equipos', params.id, body);
    if (!equipo) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json(equipo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const deleted = deleteEntity('equipos', params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Equipo not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Equipo deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
