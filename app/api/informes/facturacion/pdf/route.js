import { getInformeFacturacion } from '../../../../lib/demo-store';
import { createFacturacionPdf } from '../../../../lib/reporting';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const report = getInformeFacturacion({
      desde: searchParams.get('desde') || '',
      hasta: searchParams.get('hasta') || '',
    });

    const pdf = await createFacturacionPdf(report);

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe_facturacion_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
