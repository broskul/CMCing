import { NextResponse } from 'next/server';
import { getCotizacion } from '../../../../lib/supabase-store';
import { buildEmailHtml, createCotizacionPdf, createMailAssets, money, sendMailByGraph } from '../../../../lib/reporting';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

    const rows = (cotizacion.items || []).flatMap((item) => {
      const services = item.servicios?.length ? item.servicios : [{
        nombre: item.servicio?.descripcion || item.nombre,
        descripcionDetalle: item.descripcion,
        cantidad: item.cantidad,
        lineaTotal: item.lineaTotal,
      }];
      const itemName = escapeHtml(item.nombre || 'Ítem');
      const code = item.codigo ? `<span style="display:inline-block;margin-left:6px;color:#667085;font-size:11px;">${escapeHtml(item.codigo)}</span>` : '';

      return services.map((service) => {
        const serviceName = escapeHtml(service.nombre || service.servicio?.descripcion || 'Servicio');
        const description = service.descripcionDetalle ? `<br><span style="color:#667085;font-size:12px;">${escapeHtml(service.descripcionDetalle)}</span>` : '';
        return `
          <tr>
            <td style="padding:7px;border-bottom:1px solid #e5e7eb;"><span style="display:block;color:#667085;font-size:11px;">${itemName}${code}</span><strong>${serviceName}</strong>${description}</td>
            <td style="padding:7px;border-bottom:1px solid #e5e7eb;text-align:right;">${service.cantidad}</td>
            <td style="padding:7px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(service.lineaTotal)}</td>
          </tr>
        `;
      });
    }).join('');

    const html = buildEmailHtml({
      logoCid: 'cmcing-logo',
      title: `Cotización ${cotizacion.numero || `#${cotizacion.id}`}`,
      subtitle: `${cotizacion.cliente?.nombre || 'Cliente'} | Total ${money(cotizacion.total)}`,
      body: `
        <p style="margin:0 0 12px;">Adjuntamos cotización en PDF con el detalle solicitado.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:7px;border-bottom:1px solid #d1d5db;">Ítem, servicio y descripción</th>
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
