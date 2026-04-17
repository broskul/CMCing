import { NextResponse } from 'next/server';
import { getInformeFacturacion, getInformeVisitas } from '../../../lib/demo-store';
import {
  buildEmailHtml,
  createFacturacionPdf,
  createMailAssets,
  createVisitasPdf,
  money,
  sendMailByGraph,
} from '../../../lib/reporting';

const formatDate = (value) => new Date(value).toLocaleString('es-CL');

export async function POST(request) {
  try {
    const body = await request.json();
    const { reportType, to, cc, desde, hasta, estado, clienteId, audience } = body;

    if (!to) {
      return NextResponse.json({ error: 'Debes indicar al menos un destinatario en "to".' }, { status: 400 });
    }

    if (!['visitas', 'facturacion'].includes(reportType)) {
      return NextResponse.json({ error: 'reportType inválido. Usa "visitas" o "facturacion".' }, { status: 400 });
    }

    if (reportType === 'visitas') {
      const report = getInformeVisitas({ desde, hasta, estado, clienteId });
      const pdf = await createVisitasPdf(report);
      const { attachments: inlineAttachments, productAssets } = await createMailAssets(report.productos);

      const rows = report.visitas
        .slice(0, 8)
        .map(
          (visita) =>
            `<tr>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${formatDate(visita.fecha)}</td>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${visita.cliente?.nombre || '-'}</td>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${visita.equipo?.nombre || '-'}</td>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${visita.estado || '-'}</td>
            </tr>`
        )
        .join('');

      const html = buildEmailHtml({
        logoCid: 'cmcing-logo',
        title: audience === 'interno' ? 'Reporte Interno de Visitas' : 'Informe de Visitas para Cliente',
        subtitle: `Registros: ${report.total} | Estado filtro: ${report.filtros.estado || 'todos'}`,
        body: `
          <p style="margin:0 0 10px;">Adjuntamos el informe en PDF con el detalle completo y fotografías de los productos/equipos asociados.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Fecha</th>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Cliente</th>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Equipo</th>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Estado</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="padding:8px;">Sin registros</td></tr>'}</tbody>
          </table>
        `,
        productos: productAssets,
        footer: 'Correo emitido por la demo CMCing. Los datos son de prueba y se mantienen en memoria.',
      });

      const attachments = [
        ...inlineAttachments,
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: `informe_visitas_${Date.now()}.pdf`,
          contentType: 'application/pdf',
          contentBytes: Buffer.from(pdf).toString('base64'),
        },
      ];

      await sendMailByGraph({
        to,
        cc,
        subject: '[DEMO] Informe de Visitas CMCing',
        html,
        attachments,
      });

      return NextResponse.json({ message: 'Correo enviado correctamente' });
    }

    const report = getInformeFacturacion({ desde, hasta });
    const pdf = await createFacturacionPdf(report);
    const { attachments: inlineAttachments, productAssets } = await createMailAssets(report.productos);

    const servicioRows = report.porServicio
      .slice(0, 6)
      .map(
        (item) =>
          `<tr>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${item.servicio}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${item.cantidad}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${money(item.total)}</td>
          </tr>`
      )
      .join('');

    const html = buildEmailHtml({
      logoCid: 'cmcing-logo',
      title: audience === 'interno' ? 'Reporte Interno de Facturación' : 'Informe de Servicios y Facturación',
      subtitle: `Servicios: ${report.totalServicios} | Total: ${money(report.totalFacturado)}`,
      body: `
        <p style="margin:0 0 10px;">Adjuntamos el PDF completo con detalle por servicio, por cliente e imágenes de los productos del periodo.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Servicio</th>
              <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Cantidad</th>
              <th style="text-align:left;padding:6px;border-bottom:1px solid #d1d5db;">Total</th>
            </tr>
          </thead>
          <tbody>${servicioRows || '<tr><td colspan="3" style="padding:8px;">Sin registros</td></tr>'}</tbody>
        </table>
      `,
      productos: productAssets,
      footer: 'Correo emitido por la demo CMCing. Los datos son de prueba y se mantienen en memoria.',
    });

    const attachments = [
      ...inlineAttachments,
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: `informe_facturacion_${Date.now()}.pdf`,
        contentType: 'application/pdf',
        contentBytes: Buffer.from(pdf).toString('base64'),
      },
    ];

    await sendMailByGraph({
      to,
      cc,
      subject: '[DEMO] Informe de Facturación CMCing',
      html,
      attachments,
    });

    return NextResponse.json({ message: 'Correo enviado correctamente' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
