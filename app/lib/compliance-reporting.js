import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const COLORS = {
  ink: rgb(0.11, 0.13, 0.16),
  muted: rgb(0.38, 0.42, 0.48),
  line: rgb(0.84, 0.86, 0.89),
  accent: rgb(0.02, 0.45, 0.66),
  soft: rgb(0.94, 0.97, 0.98),
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function cleanPdfText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}

function wrapText(text, font, size, maxWidth) {
  const paragraphs = cleanPdfText(text || '-').split(/\r?\n/);
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function answerText(item) {
  const response = item.respuesta;
  if (!response) return 'Sin respuesta';
  if (item.tipoRespuesta === 'numero') {
    const unit = item.medicion?.simbolo || item.medicion?.unidad || '';
    return `${response.valorNumero ?? '-'}${unit ? ` ${unit}` : ''}`;
  }
  if (item.tipoRespuesta === 'dicotomica') return response.valorBooleano === true ? 'Cumple' : response.valorBooleano === false ? 'No cumple' : 'Sin respuesta';
  if (item.tipoRespuesta === 'seleccion_multiple') return Array.isArray(response.valorOpciones) ? response.valorOpciones.join(', ') : 'Sin respuesta';
  return response.valorTexto || 'Sin respuesta';
}

export async function buildActivityCompliancePdf(activity, imageObjects = []) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page;
  let y;

  const addHeader = async (title = 'INFORME DE ACTIVIDAD') => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
    try {
      const logoBytes = await fs.readFile(path.join(process.cwd(), 'public', 'brand', 'logo-cmcing.png'));
      const logo = await pdf.embedPng(logoBytes);
      const ratio = logo.height / logo.width;
      page.drawImage(logo, { x: MARGIN, y: y - 30, width: 116, height: 116 * ratio });
    } catch {
      page.drawText('CMCing', { x: MARGIN, y: y - 12, size: 16, font: bold, color: COLORS.accent });
    }
    page.drawText(title, { x: 220, y: y - 6, size: 15, font: bold, color: COLORS.ink });
    page.drawText(cleanPdfText(activity.ordenTrabajo?.codigo || 'OT sin código'), { x: 220, y: y - 25, size: 9, font: regular, color: COLORS.muted });
    page.drawLine({ start: { x: MARGIN, y: y - 46 }, end: { x: PAGE.width - MARGIN, y: y - 46 }, thickness: 1, color: COLORS.line });
    y -= 68;
  };

  const ensureSpace = async (height, title) => {
    if (y - height < 62) await addHeader(title || 'INFORME DE ACTIVIDAD - CONTINUACIÓN');
  };

  const drawLines = async (text, options = {}) => {
    const size = options.size || 9.5;
    const font = options.bold ? bold : regular;
    const indent = options.indent || 0;
    const lines = wrapText(text, font, size, PAGE.width - (MARGIN * 2) - indent);
    const lineHeight = options.lineHeight || size * 1.35;
    for (const line of lines) {
      await ensureSpace(lineHeight + 2);
      page.drawText(line || ' ', { x: MARGIN + indent, y, size, font, color: options.color || COLORS.ink });
      y -= lineHeight;
    }
  };

  const section = async (title) => {
    await ensureSpace(38);
    page.drawRectangle({ x: MARGIN, y: y - 20, width: PAGE.width - (MARGIN * 2), height: 26, color: COLORS.soft });
    page.drawText(cleanPdfText(title), { x: MARGIN + 10, y: y - 11, size: 10, font: bold, color: COLORS.accent });
    y -= 34;
  };

  const field = async (label, value) => {
    await ensureSpace(30);
    page.drawText(cleanPdfText(label), { x: MARGIN, y, size: 8.2, font: bold, color: COLORS.muted });
    const lines = wrapText(value || '-', regular, 9.5, PAGE.width - (MARGIN * 2) - 130);
    let fieldY = y;
    for (const line of lines) {
      page.drawText(line || '-', { x: MARGIN + 130, y: fieldY, size: 9.5, font: regular, color: COLORS.ink });
      fieldY -= 12.5;
    }
    y = Math.min(y - 16, fieldY - 3);
  };

  await addHeader();
  await section('1. IDENTIFICACIÓN');
  await field('Actividad', activity.titulo);
  await field('Tipo', activity.tipoActividad?.nombre || '-');
  await field('Cliente', activity.ordenTrabajo?.cliente?.nombre || '-');
  await field('Equipo', activity.ordenTrabajo?.equipo ? `${activity.ordenTrabajo.equipo.nombre} - ${activity.ordenTrabajo.equipo.serial || 'sin serial'}` : '-');
  await field('Técnico', activity.tecnico?.nombre || '-');
  await field('Programación', formatDate(activity.fechaProgramada));
  await field('Cierre', formatDate(activity.fechaCierre));

  await section('2. DESCRIPCIÓN Y NOTAS TÉCNICAS');
  await drawLines(activity.descripcionBreve || 'Sin descripción breve.');
  y -= 8;
  await drawLines(activity.notasTecnico || 'Sin notas técnicas.');

  for (const assignment of activity.matrices || []) {
    const category = assignment.matriz?.categoria === 'informe_resultado' ? 'INFORME / RESULTADO' : 'EVALUACIÓN';
    await section(`${category}: ${assignment.matriz?.nombre || 'Matriz'}`);
    if (assignment.matriz?.descripcion) {
      await drawLines(assignment.matriz.descripcion, { size: 8.8, color: COLORS.muted });
      y -= 6;
    }
    for (const item of assignment.items || []) {
      await ensureSpace(34);
      await drawLines(item.titulo, { bold: true, size: 9, indent: 4 });
      await drawLines(answerText(item), { size: 9.5, indent: 18, color: COLORS.ink });
      y -= 4;
    }
  }

  if (imageObjects.length) {
    await addHeader('ANEXO FOTOGRÁFICO');
    for (const imageObject of imageObjects) {
      let embedded;
      try {
        embedded = imageObject.contentType === 'image/png'
          ? await pdf.embedPng(imageObject.buffer)
          : await pdf.embedJpg(imageObject.buffer);
      } catch {
        continue;
      }
      const maxWidth = PAGE.width - (MARGIN * 2);
      const maxHeight = 390;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1);
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      await ensureSpace(height + 64, 'ANEXO FOTOGRÁFICO');
      const title = imageObject.metadata?.titulo || imageObject.nombreOriginal || 'Imagen de actividad';
      await drawLines(title, { bold: true, size: 9.5 });
      page.drawImage(embedded, { x: MARGIN, y: y - height, width, height });
      y -= height + 10;
      if (imageObject.metadata?.descripcion) await drawLines(imageObject.metadata.descripcion, { size: 8.5, color: COLORS.muted });
      y -= 16;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: PAGE.width - MARGIN, y: 42 }, thickness: 0.7, color: COLORS.line });
    item.drawText(`CMCing - Servicio técnico | Página ${index + 1} de ${pages.length}`, {
      x: MARGIN,
      y: 27,
      size: 7.5,
      font: regular,
      color: COLORS.muted,
    });
  });
  return pdf.save();
}
