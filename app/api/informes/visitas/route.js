import { NextResponse } from 'next/server';
import { getInformeVisitas } from '../../../lib/demo-store';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = getInformeVisitas({
      desde: searchParams.get('desde') || '',
      hasta: searchParams.get('hasta') || '',
      estado: searchParams.get('estado') || 'todos',
      clienteId: searchParams.get('clienteId') || '',
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
