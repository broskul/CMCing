import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { addVisitaImagen } from '../../../lib/cmms-store';
import { getR2Object, putR2Object } from '../../../lib/r2';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function sanitizeFileName(value) {
  return String(value || 'imagen')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'imagen';
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const visitaId = formData.get('visitaId');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Debes adjuntar una imagen.' }, { status: 400 });
    }

    if (!visitaId) {
      return NextResponse.json({ error: 'Debes indicar visitaId.' }, { status: 400 });
    }

    if (!String(file.type || '').startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten archivos de imagen.' }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'La imagen supera el limite de 12 MB.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = sanitizeFileName(file.name);
    const key = `visitas/${visitaId}/${Date.now()}-${randomUUID()}-${safeName}`;
    const uploaded = await putR2Object({ key, body: bytes, contentType: file.type || 'application/octet-stream' });
    const imageRecord = await addVisitaImagen({
      visitaId,
      equipoId: formData.get('equipoId') || null,
      tipo: formData.get('tipo') || 'evidencia',
      caption: formData.get('caption') || null,
      bucket: uploaded.bucket,
      objectKey: uploaded.objectKey,
      url: uploaded.url || `/api/uploads/r2?key=${encodeURIComponent(uploaded.objectKey)}`,
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
    });

    return NextResponse.json(imageRecord, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Falta key.' }, { status: 400 });
    }

    const object = await getR2Object(key);
    const body = object.Body?.transformToWebStream
      ? object.Body.transformToWebStream()
      : object.Body;

    return new Response(body, {
      headers: {
        'Content-Type': object.ContentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
