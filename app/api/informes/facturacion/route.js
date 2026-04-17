import { NextResponse } from 'next/server';
import { getInformeFacturacion } from '../../../lib/demo-store';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = getInformeFacturacion({
      desde: searchParams.get('desde') || '',
      hasta: searchParams.get('hasta') || '',
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
