import { NextResponse } from 'next/server';
import { getCotizacion } from '../../../../lib/supabase-store';
import { createCotizacionPdf } from '../../../../lib/reporting';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cotizacion = await getCotizacion(id);
    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion not found' }, { status: 404 });
    }

    const pdf = await createCotizacionPdf(cotizacion);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cotizacion_${cotizacion.numero || cotizacion.id}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
