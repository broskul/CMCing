import { NextResponse } from 'next/server';
import { deleteEntity, getTecnico, updateEntity } from '../../../lib/demo-store';

export async function GET(request, { params }) {
  try {
    const tecnico = getTecnico(params.id);
    if (!tecnico) {
      return NextResponse.json({ error: 'Técnico not found' }, { status: 404 });
    }
    return NextResponse.json(tecnico);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const tecnico = updateEntity('tecnicos', params.id, body);
    if (!tecnico) {
      return NextResponse.json({ error: 'Técnico not found' }, { status: 404 });
    }
    return NextResponse.json(tecnico);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const deleted = deleteEntity('tecnicos', params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Técnico not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Técnico deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
