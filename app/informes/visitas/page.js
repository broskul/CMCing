'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const estadoLabels = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const estadoInicialTexto = {
  pendiente: 'Equipo pendiente de intervención técnica. Se programa inspección inicial para validar condición de operación.',
  en_progreso: 'Equipo en intervención técnica. Se verifica comportamiento operativo y estabilidad durante el proceso.',
  completada: 'Equipo intervenido y operativo al cierre del servicio, conforme al alcance definido.',
  cancelada: 'Servicio cancelado por coordinación operacional; equipo sin intervención en este ciclo.',
};

const formatFriendlyDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
};

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getEquipos = (visita) => {
  if (Array.isArray(visita.equipos) && visita.equipos.length > 0) {
    return visita.equipos;
  }
  return visita.equipo ? [visita.equipo] : [];
};

const getEquiposLabel = (visita) => {
  const equipos = getEquipos(visita);
  if (equipos.length === 0) return '-';
  return equipos.map((equipo) => equipo.nombre).join(', ');
};

const getPrimaryEquipo = (visita) => getEquipos(visita)[0] || null;

const getAssetUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('r2://')) return '';
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url}`;
};

const reportStyles = `
  * { box-sizing: border-box; }
  .report-root {
    width: 190mm;
    margin: 0 auto;
    font-family: Arial, Helvetica, sans-serif;
    color: #0f172a;
  }
  .page-break { page-break-before: always; }
  .summary-page {
    border: 1px solid #dbe3f0;
    border-radius: 14px;
    background: #ffffff;
    padding: 18px;
  }
  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e5eaf4;
  }
  .summary-header img {
    width: 180px;
    height: auto;
    object-fit: contain;
  }
  .summary-title {
    margin: 14px 0 6px;
    font-size: 22px;
    font-weight: 700;
    color: #0b1324;
  }
  .summary-subtitle {
    margin: 0 0 12px;
    font-size: 12px;
    color: #4b5563;
  }
  .summary-boxes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }
  .summary-box {
    border: 1px solid #dbe3f0;
    border-radius: 10px;
    padding: 8px;
    background: #f9fbff;
  }
  .summary-box .k {
    font-size: 11px;
    text-transform: uppercase;
    color: #6b7280;
  }
  .summary-box .v {
    margin-top: 4px;
    font-size: 17px;
    font-weight: 700;
    color: #111827;
  }
  .summary-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .summary-table th,
  .summary-table td {
    border: 1px solid #d9e1ef;
    padding: 6px;
    text-align: left;
    vertical-align: top;
  }
  .summary-table th {
    background: #f2f6fd;
    font-weight: 700;
  }

  .tech-page {
    background: #ffffff;
    color: #111827;
    min-height: 277mm;
    padding: 4mm 7mm;
  }
  .tech-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .tech-header img {
    width: 178px;
    height: auto;
    object-fit: contain;
  }
  .tech-code {
    text-align: right;
    font-size: 12px;
    line-height: 1.45;
    color: #111827;
    font-weight: 700;
  }
  .tech-line {
    border-top: 3px solid #d8d8d8;
    margin: 8px 0 12px;
  }
  .tech-address {
    margin: 22px 0 18px 28px;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 700;
  }
  .tech-title {
    margin: 0 0 18px;
    text-align: center;
    font-size: 24px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0;
  }
  .equipment-heading {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 800;
  }
  .tech-grid {
    display: grid;
    grid-template-columns: 1fr 210px;
    gap: 10px;
    align-items: start;
  }
  .tech-meta {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .tech-meta td {
    border: 0;
    padding: 2px 5px 2px 0;
    vertical-align: top;
    background: #ffffff;
    color: #111827;
    font-size: 13px;
  }
  .tech-meta td.label {
    width: 150px;
    font-weight: 700;
    background: #ffffff;
  }
  .tech-photo {
    background: #ffffff;
    min-height: 145px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }
  .tech-photo img {
    width: 100%;
    max-height: 160px;
    object-fit: contain;
  }
  .classic-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 12px;
  }
  .classic-table td {
    border: 1px solid #a9a9a9;
    padding: 4px 6px;
    vertical-align: top;
  }
  .classic-table .label-row {
    font-weight: 700;
  }
  .section-bar {
    margin-top: 18px;
    border-bottom: 1px solid #cfcfcf;
    background: #eeeeee;
    padding: 4px 6px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .checkline {
    display: grid;
    grid-template-columns: 18px 1fr 58px;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 13px;
  }
  .checkbox-mark {
    width: 7px;
    height: 7px;
    border: 1px solid #111827;
  }
  .xbox {
    border: 1px solid #6b7280;
    padding: 2px 0;
    text-align: center;
    font-weight: 800;
  }
  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 18px;
  }
  .signature-box {
    min-height: 86px;
    border-top: 1px solid #9ca3af;
    padding-top: 6px;
    font-size: 11px;
  }
  .signature-box img {
    max-height: 58px;
    max-width: 180px;
    object-fit: contain;
    display: block;
    margin-bottom: 4px;
  }
  .tech-footer {
    margin-top: 18px;
    border-top: 2px solid #9ca3af;
    padding-top: 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 10px;
    color: #334155;
  }
`;

const buildTechnicalVisitSection = (visita, index) => {
  const equipos = getEquipos(visita);
  const primaryEquipo = equipos[0] || null;
  const equiposListado = equipos.length
    ? equipos.map((equipo) => `${equipo.nombre}${equipo.modelo ? ` (${equipo.modelo})` : ''}${equipo.serial ? ` - ${equipo.serial}` : ''}`).join(' | ')
    : '-';

  const objetivo = 'Verificar el correcto funcionamiento del equipo de acuerdo a especificaciones de fábrica y condiciones operativas del cliente.';
  const especificaciones = 'Para cada medición se debe cumplir que los parámetros de operación programados y obtenidos correspondan al proceso esperado.';
  const trabajos = visita.descripcion || 'Se ejecuta inspección técnica y pruebas funcionales según plan de servicio.';
  const resultadoFinal = visita.notasTecnicas || `Estado de cierre: ${estadoLabels[visita.estado] || visita.estado || '-'}. Se deja registro técnico de visita para trazabilidad.`;
  const recomendaciones = 'Mantener plan de mantenimiento preventivo, validar calibración periódica y documentar cualquier desviación operativa.';
  const firmaImagenUrl = visita.firmaTecnicoImagenUrl || visita.tecnico?.firmaImagenUrl || '';
  const selfie = Array.isArray(visita.adjuntos) ? visita.adjuntos.find((adjunto) => adjunto.tipo === 'selfie_firma') : null;
  const evidencias = Array.isArray(visita.adjuntos) ? visita.adjuntos.filter((adjunto) => adjunto.tipo === 'evidencia') : [];

  return `
    <section class="tech-page ${index > 0 ? 'page-break' : ''}">
      <div class="tech-header">
        <img src="${escapeHtml(getAssetUrl('/brand/logo-cmcing.png'))}" alt="CMCiing" />
        <div class="tech-code">
          ${escapeHtml(new Date(visita.fecha).toLocaleDateString('es-CL', { dateStyle: 'long' }))}<br/>
          IT_${escapeHtml(new Date(visita.fecha).getFullYear())} ${escapeHtml(String(visita.id).padStart(4, '0'))} / ${escapeHtml(visita.cliente?.nombre || 'CLIENTE')}
        </div>
      </div>

      <div class="tech-address">
        Sres. ${escapeHtml(visita.cliente?.nombre || '-')}<br/>
        Att. : Responsable de mantención<br/>
        Ref. : Informe Técnico de ${escapeHtml(visita.servicio?.descripcion || 'Servicio Técnico')}.
      </div>

      <div class="tech-line"></div>
      <h1 class="tech-title">INFORME TÉCNICO</h1>
      <p class="equipment-heading">DATOS DEL EQUIPO</p>

      <div class="tech-grid">
        <table class="tech-meta">
          <tbody>
            <tr><td class="label">EQUIPO</td><td>${escapeHtml(primaryEquipo?.nombre || getEquiposLabel(visita))}</td></tr>
            <tr><td class="label">MARCA</td><td>${escapeHtml(primaryEquipo?.fabricante || '-')}</td></tr>
            <tr><td class="label">MODELO</td><td>${escapeHtml(primaryEquipo?.modelo || '-')}</td></tr>
            <tr><td class="label">N° SERIE</td><td>${escapeHtml(primaryEquipo?.serial || '-')}</td></tr>
            <tr><td class="label">SKU / IDENTIFICACIÓN</td><td>${escapeHtml(primaryEquipo?.sku || '-')}</td></tr>
            <tr><td class="label">UBICACIÓN</td><td>${escapeHtml(primaryEquipo?.ubicacion || '-')}</td></tr>
          </tbody>
        </table>

        <div class="tech-photo">
          ${primaryEquipo?.imagenUrl ? `<img src="${escapeHtml(getAssetUrl(primaryEquipo.imagenUrl))}" alt="Equipo" />` : '<span style="font-size:11px;color:#64748b;">Sin imagen</span>'}
        </div>
      </div>

      <table class="classic-table">
        <tbody>
          <tr><td class="label-row">OBJETIVO</td></tr>
          <tr><td>- ${escapeHtml(objetivo)}</td></tr>
          <tr><td class="label-row">ESPECIFICACIONES</td></tr>
          <tr><td>- ${escapeHtml(especificaciones)}</td></tr>
        </tbody>
      </table>

      <div class="section-bar">I. Estado inicial</div>
      ${['Chequeo primario de funcionamiento', 'Chequeo estructural, accesorios y componentes', 'Chequeo de controles y comandos', 'Chequeo de conexiones eléctricas'].map((item) => `
        <div class="checkline"><span class="checkbox-mark"></span><span>${item}</span><span class="xbox">X</span></div>
      `).join('')}

      <div class="section-bar">II. Trabajos realizados y reportes</div>
      <div style="margin-top:10px;font-size:13px;line-height:1.45;white-space:pre-line;">${escapeHtml(trabajos)}</div>

      <div class="section-bar">III. Resultado final</div>
      <div style="margin-top:10px;font-size:13px;line-height:1.45;white-space:pre-line;">${escapeHtml(resultadoFinal)}</div>

      <div class="section-bar">IV. Recomendaciones</div>
      <div style="margin-top:10px;font-size:13px;line-height:1.45;white-space:pre-line;">${escapeHtml(recomendaciones)}</div>

      ${evidencias.length ? `
        <div class="section-bar">V. Evidencias adjuntas</div>
        <div style="margin-top:8px;font-size:12px;line-height:1.5;">${evidencias.map((adjunto) => escapeHtml(adjunto.nombreOriginal || adjunto.r2Key || 'Adjunto')).join('<br/>')}</div>
      ` : ''}

      <div class="signature-grid">
        <div class="signature-box">
          ${firmaImagenUrl ? `<img src="${escapeHtml(getAssetUrl(firmaImagenUrl))}" alt="Firma técnico" />` : ''}
          ${escapeHtml(visita.firmaTecnicoTexto || visita.tecnico?.firmaTexto || visita.tecnico?.nombre || '-')}
        </div>
        <div class="signature-box">
          ${selfie?.publicUrl ? `<img src="${escapeHtml(getAssetUrl(selfie.publicUrl))}" alt="Foto técnico" />` : ''}
          Foto de validación al firmar
        </div>
      </div>

      <div class="tech-footer">
        <div><strong>CMC Ingeniería y Servicios.</strong><br/>Beaucheff 1699 - Santiago</div>
        <div style="text-align:right;">Fono: (56-9) 77667626<br/>Web: www.cmcing.cl</div>
      </div>
    </section>
  `;
};

const buildGeneralVisitsReportHtml = ({ filtros, visitas, total }) => {
  const rows = visitas.map((visita) => `
    <tr>
      <td>${escapeHtml(formatFriendlyDate(visita.fecha))}</td>
      <td>${escapeHtml(visita.cliente?.nombre || '-')}</td>
      <td>${escapeHtml(getEquiposLabel(visita))}</td>
      <td>${escapeHtml(visita.tecnico?.nombre || '-')}</td>
      <td>${escapeHtml(visita.servicio?.descripcion || '-')}</td>
      <td>${escapeHtml(estadoLabels[visita.estado] || visita.estado || '-')}</td>
    </tr>
  `).join('');

  const techPages = visitas.map((visita, index) => buildTechnicalVisitSection(visita, index + 1)).join('');

  return `
    <div class="report-root">
      <style>${reportStyles}</style>

      <section class="summary-page">
        <div class="summary-header">
          <img src="${escapeHtml(getAssetUrl('/brand/logo-cmcing.png'))}" alt="CMCiing" />
          <div style="font-size:11px;color:#475569;text-align:right;">
            Informe completo de visitas<br/>
            Emitido: ${escapeHtml(new Date().toLocaleString('es-CL'))}
          </div>
        </div>

        <h1 class="summary-title">Informe de Visitas Técnicas</h1>
        <p class="summary-subtitle">
          Filtros aplicados: desde ${escapeHtml(filtros.desde || 'sin límite')} | hasta ${escapeHtml(filtros.hasta || 'sin límite')} |
          estado ${escapeHtml(filtros.estado || 'todos')}
        </p>

        <div class="summary-boxes">
          <div class="summary-box"><div class="k">Total visitas</div><div class="v">${escapeHtml(total)}</div></div>
          <div class="summary-box"><div class="k">Clientes distintos</div><div class="v">${escapeHtml(new Set(visitas.map((v) => v.cliente?.nombre || '-')).size)}</div></div>
          <div class="summary-box"><div class="k">Equipos referenciados</div><div class="v">${escapeHtml(new Set(visitas.flatMap((v) => getEquipos(v).map((e) => e.id)).filter(Boolean)).size)}</div></div>
        </div>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Equipos</th>
              <th>Técnico</th>
              <th>Servicio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6">Sin registros</td></tr>'}
          </tbody>
        </table>
      </section>

      ${techPages}
    </div>
  `;
};

const buildSingleTechnicalReportHtml = (visita) => `
  <div class="report-root">
    <style>${reportStyles}</style>
    ${buildTechnicalVisitSection(visita, 0)}
  </div>
`;

const generatePdfFromHtml = async ({ html, filename }) => {
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = html2pdfModule.default || html2pdfModule;

  if (typeof html2pdf !== 'function') {
    throw new Error('No se pudo inicializar html2pdf.');
  }

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '99999';
  overlay.style.background = 'rgba(15, 23, 42, 0.38)';
  overlay.style.backdropFilter = 'blur(1px)';
  overlay.style.padding = '16px';
  overlay.style.overflow = 'auto';

  const shell = document.createElement('div');
  shell.style.width = '210mm';
  shell.style.margin = '0 auto';
  shell.style.background = '#ffffff';
  shell.style.boxShadow = '0 20px 60px rgba(15, 23, 42, 0.22)';
  shell.style.borderRadius = '10px';
  shell.style.padding = '8mm';
  shell.innerHTML = html;

  const badge = document.createElement('div');
  badge.textContent = 'Generando PDF...';
  badge.style.position = 'sticky';
  badge.style.top = '6px';
  badge.style.width = 'fit-content';
  badge.style.margin = '0 auto 10px';
  badge.style.padding = '8px 12px';
  badge.style.borderRadius = '9999px';
  badge.style.background = '#111827';
  badge.style.color = '#ffffff';
  badge.style.font = '600 12px Arial, sans-serif';
  badge.style.letterSpacing = '0.02em';

  overlay.appendChild(badge);
  overlay.appendChild(shell);
  document.body.appendChild(overlay);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const images = Array.from(shell.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      })
    );

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await html2pdf().set({
      margin: [5, 5, 5, 5],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: shell.scrollWidth,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break' },
    }).from(shell).save();
  } catch (error) {
    console.error('Error generando PDF html2pdf:', error);
    throw error;
  } finally {
    document.body.removeChild(overlay);
  }
};

export default function InformeVisitasPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', estado: 'todos', clienteId: '' });
  const [clientes, setClientes] = useState([]);
  const [resultado, setResultado] = useState({ total: 0, visitas: [], productos: [] });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingFullPdf, setGeneratingFullPdf] = useState(false);
  const [generatingVisitPdfId, setGeneratingVisitPdfId] = useState(null);
  const [mailForm, setMailForm] = useState({ to: '', cc: '', audience: 'interno' });
  const [mailStatus, setMailStatus] = useState('');

  useEffect(() => {
    const loadInitialData = async () => {
      const clientesRes = await fetch('/api/clientes');
      const clientesData = await clientesRes.json();
      setClientes(Array.isArray(clientesData) ? clientesData : []);
    };

    loadInitialData();
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.clienteId) params.set('clienteId', filtros.clienteId);
    return params.toString();
  }, [filtros]);

  useEffect(() => {
    const fetchInforme = async () => {
      setLoading(true);
      const res = await fetch(`/api/informes/visitas?${queryString}`);
      const data = await res.json();
      setResultado({ total: data.total || 0, visitas: data.visitas || [], productos: data.productos || [] });
      setLoading(false);
    };

    fetchInforme();
  }, [queryString]);

  const exportCsv = () => {
    const headers = ['Fecha', 'Cliente', 'Equipos', 'Técnico', 'Servicio', 'Estado'];
    const rows = resultado.visitas.map((v) => [
      new Date(v.fecha).toLocaleString('es-CL'),
      v.cliente?.nombre || '-',
      getEquiposLabel(v),
      v.tecnico?.nombre || '-',
      v.servicio?.descripcion || '-',
      estadoLabels[v.estado] || v.estado || '-',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_visitas_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFullHtmlPdf = async () => {
    if (!resultado.visitas.length) {
      alert('No hay visitas para generar el informe.');
      return;
    }

    setGeneratingFullPdf(true);
    try {
      const html = buildGeneralVisitsReportHtml({
        filtros,
        visitas: resultado.visitas,
        total: resultado.total,
      });

      await generatePdfFromHtml({
        html,
        filename: `informe_visitas_completo_${Date.now()}.pdf`,
      });
    } catch (error) {
      alert(`No se pudo generar el PDF completo: ${error.message}`);
    } finally {
      setGeneratingFullPdf(false);
    }
  };

  const exportTechnicalVisitPdf = async (visita) => {
    setGeneratingVisitPdfId(visita.id);
    try {
      const html = buildSingleTechnicalReportHtml(visita);
      await generatePdfFromHtml({
        html,
        filename: `informe_tecnico_visita_${visita.id}_${Date.now()}.pdf`,
      });
    } catch (error) {
      alert(`No se pudo generar el informe técnico: ${error.message}`);
    } finally {
      setGeneratingVisitPdfId(null);
    }
  };

  const sendMail = async () => {
    setSending(true);
    setMailStatus('');

    try {
      const res = await fetch('/api/informes/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'visitas',
          to: mailForm.to,
          cc: mailForm.cc,
          audience: mailForm.audience,
          ...filtros,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar el correo');
      }

      setMailStatus('Correo enviado correctamente.');
    } catch (error) {
      setMailStatus(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="panel p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Informe 1</p>
          <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Informe de Visitas</h1>
        </section>

        <section className="panel p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <label className="text-[0.85rem] text-neutral-700">
              Desde
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => setFiltros((prev) => ({ ...prev, desde: e.target.value }))}
                className="input-base mt-1"
              />
            </label>
            <label className="text-[0.85rem] text-neutral-700">
              Hasta
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => setFiltros((prev) => ({ ...prev, hasta: e.target.value }))}
                className="input-base mt-1"
              />
            </label>
            <label className="text-[0.85rem] text-neutral-700">
              Estado
              <select
                value={filtros.estado}
                onChange={(e) => setFiltros((prev) => ({ ...prev, estado: e.target.value }))}
                className="input-base mt-1"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            <label className="text-[0.85rem] text-neutral-700 md:col-span-2">
              Cliente
              <select
                value={filtros.clienteId}
                onChange={(e) => setFiltros((prev) => ({ ...prev, clienteId: e.target.value }))}
                className="input-base mt-1"
              >
                <option value="">Todos los clientes</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={exportFullHtmlPdf}
              disabled={generatingFullPdf}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingFullPdf ? 'Generando PDF...' : 'Generar PDF completo (html2pdf)'}
            </button>
            <button onClick={exportCsv} className="rounded-xl bg-emerald-700 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-emerald-600">Exportar CSV</button>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[1.05rem] font-semibold text-neutral-900">Resultados</h2>
            <span className="text-[0.9rem] text-neutral-600">Total registros: {resultado.total}</span>
          </div>
          {loading ? (
            <p className="text-[0.9rem] text-neutral-600">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-neutral-100/80">
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Fecha</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Cliente</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Equipos</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Imagen</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Técnico</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Servicio</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Estado</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Informe técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.visitas.map((visita) => {
                    const primaryEquipo = getPrimaryEquipo(visita);
                    return (
                      <tr key={visita.id} className="border-t border-neutral-200">
                        <td className="px-3 py-2 text-[0.88rem]">{new Date(visita.fecha).toLocaleString('es-CL')}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{visita.cliente?.nombre || '-'}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{getEquiposLabel(visita)}</td>
                        <td className="px-3 py-2 text-[0.88rem]">
                          {primaryEquipo?.imagenUrl ? (
                            <Image src={primaryEquipo.imagenUrl} alt={primaryEquipo.nombre || 'Equipo'} width={120} height={70} className="h-14 w-24 rounded-md border border-neutral-200 object-contain" />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-[0.88rem]">{visita.tecnico?.nombre || '-'}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{visita.servicio?.descripcion || '-'}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{estadoLabels[visita.estado] || visita.estado || '-'}</td>
                        <td className="px-3 py-2 text-[0.88rem]">
                          <button
                            onClick={() => exportTechnicalVisitPdf(visita)}
                            disabled={generatingVisitPdfId === visita.id}
                            className="rounded-lg bg-sky-700 px-3 py-1 text-[0.78rem] font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {generatingVisitPdfId === visita.id ? 'Generando...' : 'PDF técnico'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 text-[1.05rem] font-semibold text-neutral-900">Enviar Informe por Correo (MS Graph)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-[0.85rem] text-neutral-700 md:col-span-2">
              Para
              <input type="text" value={mailForm.to} onChange={(e) => setMailForm((prev) => ({ ...prev, to: e.target.value }))} className="input-base mt-1" placeholder="correo1@cliente.cl, correo2@cliente.cl" />
            </label>
            <label className="text-[0.85rem] text-neutral-700 md:col-span-2">
              CC
              <input type="text" value={mailForm.cc} onChange={(e) => setMailForm((prev) => ({ ...prev, cc: e.target.value }))} className="input-base mt-1" placeholder="interno@cmcing.cl" />
            </label>
            <label className="text-[0.85rem] text-neutral-700">
              Tipo destinatario
              <select value={mailForm.audience} onChange={(e) => setMailForm((prev) => ({ ...prev, audience: e.target.value }))} className="input-base mt-1">
                <option value="interno">Interno</option>
                <option value="cliente_final">Cliente final</option>
              </select>
            </label>
            <div className="md:col-span-3 flex items-end">
              <button disabled={sending} onClick={sendMail} className="rounded-xl bg-indigo-700 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60">
                {sending ? 'Enviando...' : 'Enviar correo con PDF adjunto'}
              </button>
            </div>
          </div>
          {mailStatus ? <p className="mt-3 text-[0.9rem] text-neutral-700">{mailStatus}</p> : null}
        </section>
      </div>
    </div>
  );
}
