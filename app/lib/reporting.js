import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const LOGO_PATH = '/brand/logo-cmcing.png';

const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value || 0);
const formatDate = (value) => new Date(value).toLocaleString('es-CL');

function getVisitaEquipos(visita) {
  if (Array.isArray(visita.equipos) && visita.equipos.length > 0) {
    return visita.equipos;
  }
  if (visita.equipo) {
    return [visita.equipo];
  }
  return [];
}

function getPublicAbsolutePath(publicPath) {
  const clean = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
  return path.join(process.cwd(), 'public', clean);
}

async function readPublicAsset(publicPath) {
  return readFile(getPublicAbsolutePath(publicPath));
}

async function loadImageBytes(imageUrl) {
  if (!imageUrl) return null;

  if (imageUrl.startsWith('/')) {
    return readPublicAsset(imageUrl);
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`No se pudo descargar imagen: ${imageUrl}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function embedImage(pdfDoc, imageUrl, cache) {
  if (!imageUrl) return null;
  if (cache.has(imageUrl)) return cache.get(imageUrl);

  const bytes = await loadImageBytes(imageUrl);
  if (!bytes) return null;

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  cache.set(imageUrl, image);
  return image;
}

function drawFittedImage(page, image, x, y, maxWidth, maxHeight) {
  if (!image) return;
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  const posX = x + (maxWidth - width) / 2;
  const posY = y + (maxHeight - height) / 2;

  page.drawImage(image, { x: posX, y: posY, width, height });
}

async function drawHeader({ page, pdfDoc, title, subtitle }) {
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedImage(pdfDoc, LOGO_PATH, new Map());

  const { width, height } = page.getSize();
  page.drawRectangle({ x: 30, y: height - 90, width: width - 60, height: 60, color: rgb(0.96, 0.97, 0.99) });
  drawFittedImage(page, logo, 40, height - 82, 150, 44);

  page.drawText(title, { x: 210, y: height - 56, size: 15, font: fontBold, color: rgb(0.08, 0.11, 0.2) });
  page.drawText(subtitle, { x: 210, y: height - 74, size: 10, font: fontRegular, color: rgb(0.35, 0.38, 0.45) });

  return { fontRegular, fontBold };
}

async function createVisitasPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const imageCache = new Map();

  let page = pdfDoc.addPage([595, 842]);
  let y = 710;

  let fonts = await drawHeader({
    page,
    pdfDoc,
    title: 'Informe de Visitas - Demo CMCing',
    subtitle: `Emitido: ${formatDate(new Date())}`,
  });

  page.drawText(`Filtros: Desde ${data.filtros.desde || 'sin límite'} | Hasta ${data.filtros.hasta || 'sin límite'} | Estado ${data.filtros.estado || 'todos'}`, {
    x: 30,
    y: 680,
    size: 9,
    font: fonts.fontRegular,
    color: rgb(0.4, 0.4, 0.46),
  });

  page.drawText(`Total registros: ${data.total}`, {
    x: 30,
    y: 664,
    size: 10,
    font: fonts.fontBold,
    color: rgb(0.1, 0.1, 0.12),
  });

  y = 640;

  for (const visita of data.visitas) {
    if (y < 150) {
      page = pdfDoc.addPage([595, 842]);
      fonts = await drawHeader({
        page,
        pdfDoc,
        title: 'Informe de Visitas - Continuación',
        subtitle: `Emitido: ${formatDate(new Date())}`,
      });
      y = 700;
    }

    page.drawRectangle({ x: 30, y: y - 102, width: 535, height: 96, borderWidth: 1, borderColor: rgb(0.86, 0.88, 0.92) });
    page.drawText(`${formatDate(visita.fecha)} | ${visita.estado.toUpperCase()}`, {
      x: 40,
      y: y - 22,
      size: 9,
      font: fonts.fontBold,
      color: rgb(0.1, 0.16, 0.25),
    });

    const equipos = getVisitaEquipos(visita);
    const equiposLabel = equipos.length > 0
      ? equipos.map((equipo) => `${equipo.nombre}${equipo.modelo ? ` (${equipo.modelo})` : ''}`).join(', ')
      : '-';
    const line1 = `Cliente: ${visita.cliente?.nombre || '-'} | Técnico: ${visita.tecnico?.nombre || '-'} | Servicio: ${visita.servicio?.descripcion || '-'}`;
    const line2 = `Equipos: ${equiposLabel}`;
    const line3 = `Detalle: ${visita.descripcion || 'Sin observaciones'}`;

    page.drawText(line1.slice(0, 90), { x: 40, y: y - 40, size: 9, font: fonts.fontRegular, color: rgb(0.2, 0.2, 0.22) });
    page.drawText(line2.slice(0, 90), { x: 40, y: y - 56, size: 9, font: fonts.fontRegular, color: rgb(0.2, 0.2, 0.22) });
    page.drawText(line3.slice(0, 90), { x: 40, y: y - 72, size: 9, font: fonts.fontRegular, color: rgb(0.2, 0.2, 0.22) });

    const productImage = await embedImage(pdfDoc, equipos[0]?.imagenUrl, imageCache);
    if (productImage) {
      page.drawRectangle({ x: 430, y: y - 90, width: 125, height: 72, borderWidth: 1, borderColor: rgb(0.9, 0.9, 0.94) });
      drawFittedImage(page, productImage, 433, y - 87, 119, 66);
    }

    y -= 112;
  }

  return Buffer.from(await pdfDoc.save());
}

async function createFacturacionPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const imageCache = new Map();

  const page = pdfDoc.addPage([595, 842]);
  const fonts = await drawHeader({
    page,
    pdfDoc,
    title: 'Informe de Facturación - Demo CMCing',
    subtitle: `Emitido: ${formatDate(new Date())}`,
  });

  page.drawText(`Total servicios: ${data.totalServicios}`, {
    x: 30,
    y: 676,
    size: 11,
    font: fonts.fontBold,
    color: rgb(0.1, 0.14, 0.2),
  });

  page.drawText(`Total facturado: ${money(data.totalFacturado)}`, {
    x: 30,
    y: 658,
    size: 11,
    font: fonts.fontBold,
    color: rgb(0.1, 0.14, 0.2),
  });

  page.drawText('Resumen por servicio:', { x: 30, y: 632, size: 10, font: fonts.fontBold, color: rgb(0.15, 0.18, 0.25) });
  let y = 616;

  data.porServicio.slice(0, 6).forEach((item) => {
    page.drawText(`${item.servicio}: ${item.cantidad} | ${money(item.total)}`, {
      x: 35,
      y,
      size: 9,
      font: fonts.fontRegular,
      color: rgb(0.2, 0.2, 0.25),
    });
    y -= 14;
  });

  y -= 8;
  page.drawText('Resumen por cliente:', { x: 30, y, size: 10, font: fonts.fontBold, color: rgb(0.15, 0.18, 0.25) });
  y -= 16;

  data.porCliente.slice(0, 6).forEach((item) => {
    page.drawText(`${item.cliente}: ${item.cantidad} | ${money(item.total)}`, {
      x: 35,
      y,
      size: 9,
      font: fonts.fontRegular,
      color: rgb(0.2, 0.2, 0.25),
    });
    y -= 14;
  });

  y -= 12;
  page.drawText('Productos incluidos en el periodo:', { x: 30, y, size: 10, font: fonts.fontBold, color: rgb(0.15, 0.18, 0.25) });
  y -= 12;

  let x = 30;
  for (const producto of data.productos.slice(0, 4)) {
    const image = await embedImage(pdfDoc, producto.imagenUrl, imageCache);
    page.drawRectangle({ x, y: y - 108, width: 120, height: 100, borderWidth: 1, borderColor: rgb(0.88, 0.9, 0.94) });

    if (image) {
      drawFittedImage(page, image, x + 4, y - 88, 112, 72);
    }

    page.drawText(`${producto.nombre} ${producto.modelo || ''}`.slice(0, 28), {
      x: x + 4,
      y: y - 100,
      size: 8,
      font: fonts.fontRegular,
      color: rgb(0.2, 0.2, 0.25),
    });

    x += 130;
    if (x > 430) {
      x = 30;
      y -= 120;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

function splitRecipients(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
}

function buildEmailHtml({ logoCid, title, subtitle, body, productos = [], footer }) {
  const productCards = productos
    .map((producto) => {
      const imageBlock = producto.cid
        ? `<img src="cid:${producto.cid}" alt="${producto.nombre}" style="width:100%;height:150px;object-fit:contain;border-radius:10px;background:#f5f7fb;"/>`
        : '';

      return `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#ffffff;">
          ${imageBlock}
          <p style="margin:10px 0 0;font-size:13px;color:#111827;"><strong>${producto.nombre}</strong><br/>${producto.modelo || ''}</p>
        </div>
      `;
    })
    .join('');

  return `
    <div style="background:#f3f5f8;padding:24px 0;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;padding:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
          <img src="cid:${logoCid}" alt="CMCiing" style="max-width:200px;max-height:62px;width:auto;height:auto;object-fit:contain;" />
          <div style="text-align:right;font-size:12px;color:#6b7280;">Demo Comercial</div>
        </div>
        <h1 style="margin:18px 0 4px;font-size:22px;line-height:1.2;">${title}</h1>
        <p style="margin:0 0 16px;color:#4b5563;">${subtitle}</p>
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;background:#fafbff;">
          ${body}
        </div>
        ${productos.length ? `<div style="margin-top:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">${productCards}</div>` : ''}
        <p style="margin-top:18px;font-size:12px;color:#6b7280;">${footer}</p>
      </div>
    </div>
  `;
}

async function createMailAssets(productos = []) {
  const attachments = [];

  const logoBytes = await readPublicAsset(LOGO_PATH);
  attachments.push({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: 'logo-cmcing.png',
    contentType: 'image/png',
    isInline: true,
    contentId: 'cmcing-logo',
    contentBytes: Buffer.from(logoBytes).toString('base64'),
  });

  const productAssets = [];
  let index = 1;

  for (const producto of productos.slice(0, 4)) {
    if (!producto.imagenUrl) continue;

    const bytes = await loadImageBytes(producto.imagenUrl);
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const extension = isPng ? 'png' : 'jpg';
    const contentType = isPng ? 'image/png' : 'image/jpeg';
    const cid = `producto-${index}`;

    attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: `${cid}.${extension}`,
      contentType,
      isInline: true,
      contentId: cid,
      contentBytes: Buffer.from(bytes).toString('base64'),
    });

    productAssets.push({ ...producto, cid });
    index += 1;
  }

  return { attachments, productAssets };
}

async function sendMailByGraph({ to, cc, subject, html, attachments }) {
  const tenant = process.env.MSGRAPH_TENANT_ID;
  const clientId = process.env.MSGRAPH_CLIENT_ID;
  const clientSecret = process.env.MSGRAPH_CLIENT_SECRET;
  const sender = process.env.MSGRAPH_SENDER;

  if (!tenant || !clientId || !clientSecret || !sender) {
    throw new Error('Faltan variables para MS Graph. Define MSGRAPH_TENANT_ID, MSGRAPH_CLIENT_ID, MSGRAPH_CLIENT_SECRET y MSGRAPH_SENDER en .env.local.');
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenRes.ok) {
    const message = await tokenRes.text();
    throw new Error(`No se pudo obtener token de MS Graph: ${message}`);
  }

  const tokenData = await tokenRes.json();
  const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: html,
        },
        toRecipients: splitRecipients(to),
        ccRecipients: splitRecipients(cc),
        attachments,
      },
      saveToSentItems: true,
    }),
  });

  if (!sendRes.ok) {
    const message = await sendRes.text();
    throw new Error(`MS Graph rechazó el envío: ${message}`);
  }
}

export {
  buildEmailHtml,
  createFacturacionPdf,
  createMailAssets,
  createVisitasPdf,
  money,
  sendMailByGraph,
};
