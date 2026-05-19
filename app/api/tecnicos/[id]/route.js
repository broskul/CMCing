import { NextResponse } from 'next/server';
import { deleteTecnico, getTecnico, updateTecnico } from '../../../lib/cmms-store';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const tecnico = await getTecnico(id);
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
    const { id } = await params;
    const body = await request.json();
    const tecnico = await updateTecnico(id, body);
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
    const { id } = await params;
    const deleted = await deleteTecnico(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Técnico not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Técnico deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
