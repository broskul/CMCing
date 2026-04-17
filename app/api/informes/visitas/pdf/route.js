import { getInformeVisitas } from '../../../../lib/demo-store';
import { createVisitasPdf } from '../../../../lib/reporting';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const report = getInformeVisitas({
      desde: searchParams.get('desde') || '',
      hasta: searchParams.get('hasta') || '',
      estado: searchParams.get('estado') || 'todos',
      clienteId: searchParams.get('clienteId') || '',
    });

    const pdf = await createVisitasPdf(report);

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe_visitas_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
