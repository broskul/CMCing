import { NextResponse } from 'next/server';
import { getCotizacion } from '../../../../lib/supabase-store';
import { buildEmailHtml, createCotizacionPdf, createMailAssets, money, sendMailByGraph } from '../../../../lib/reporting';

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { to, cc } = body;

    if (!to) {
      return NextResponse.json({ error: 'Debes indicar al menos un destinatario.' }, { status: 400 });
    }

    const { id } = await params;
    const cotizacion = await getCotizacion(id);
    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion not found' }, { status: 404 });
    }

    const pdf = await createCotizacionPdf(cotizacion);
    const { attachments: inlineAttachments } = await createMailAssets([]);

    const rows = (cotizacion.items || []).map((item) => `
      <tr>
        <td style="padding:7px;border-bottom:1px solid #e5e7eb;">${item.descripcion}</td>
        <td style="padding:7px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.cantidad}</td>
        <td style="padding:7px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(item.lineaTotal)}</td>
      </tr>
    `).join('');

    const html = buildEmailHtml({
      logoCid: 'cmcing-logo',
      title: `Cotización ${cotizacion.numero || `#${cotizacion.id}`}`,
      subtitle: `${cotizacion.cliente?.nombre || 'Cliente'} | Total ${money(cotizacion.total)}`,
      body: `
        <p style="margin:0 0 12px;">Adjuntamos cotización en PDF con el detalle solicitado.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:7px;border-bottom:1px solid #d1d5db;">Detalle</th>
              <th style="text-align:right;padding:7px;border-bottom:1px solid #d1d5db;">Cantidad</th>
              <th style="text-align:right;padding:7px;border-bottom:1px solid #d1d5db;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `,
      footer: 'Correo emitido por CMCing.',
    });

    await sendMailByGraph({
      to,
      cc,
      subject: `Cotización ${cotizacion.numero || cotizacion.id} - CMCing`,
      html,
      attachments: [
        ...inlineAttachments,
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: `cotizacion_${cotizacion.numero || cotizacion.id}.pdf`,
          contentType: 'application/pdf',
          contentBytes: Buffer.from(pdf).toString('base64'),
        },
      ],
    });

    return NextResponse.json({ message: 'Correo enviado correctamente' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
