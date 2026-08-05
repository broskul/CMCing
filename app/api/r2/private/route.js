import { NextResponse } from 'next/server';
import { requireRequestUser } from '../../../lib/request-auth';
import { getObjectStreamFromR2, parsePrivateR2Url } from '../../../lib/r2';
import { getSupabaseAdmin } from '../../../lib/supabase-server';

export const runtime = 'nodejs';

const INLINE_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function unavailableFileError() {
  return Object.assign(new Error('Archivo no disponible.'), { status: 404 });
}

function normalizeKey(value) {
  const parsed = parsePrivateR2Url(value);
  const key = parsed?.key || String(value || '');

  if (!key || key.startsWith('/') || key.includes('..')) return '';
  if (!/^(private\/|firmas\/|servicios\/)/.test(key)) return '';

  return key;
}

function normalizeRange(value) {
  const range = String(value || '').trim();
  return /^bytes=\d*-\d*$/.test(range) ? range : '';
}

function normalizedContentType(value) {
  const contentType = String(value || '').split(';', 1)[0].trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType)
    ? contentType
    : 'application/octet-stream';
}

function safeDownloadName(key) {
  const filename = String(key || '').split('/').pop() || 'archivo';
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-180) || 'archivo';
}

async function assertCanReadKey(user, key) {
  const role = String(user?.rol || '').toUpperCase();
  if (['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA'].includes(role)) return;
  if (role !== 'TECNICO' || !user?.tecnicoId) throw unavailableFileError();

  const admin = getSupabaseAdmin();
  if (key.startsWith('private/equipos/')) {
    const { data: equipment, error: equipmentError } = await admin
      .from('Equipo')
      .select('id')
      .eq('imagenR2Key', key)
      .maybeSingle();
    if (equipmentError || !equipment) throw unavailableFileError();

    const { data: activities, error: activitiesError } = await admin
      .from('OrdenTrabajoActividad')
      .select('ordenTrabajoId')
      .eq('tecnicoId', user.tecnicoId)
      .limit(250);
    if (activitiesError) throw unavailableFileError();
    const orderIds = [...new Set((activities || []).map((item) => Number(item.ordenTrabajoId)).filter(Number.isInteger))];
    if (!orderIds.length) throw unavailableFileError();

    const [primaryResult, linkedResult] = await Promise.all([
      admin.from('OrdenTrabajo').select('id').in('id', orderIds).eq('equipoId', equipment.id).limit(1),
      admin.from('OrdenTrabajoEquipo').select('id').in('ordenTrabajoId', orderIds).eq('equipoId', equipment.id).limit(1),
    ]);
    if (primaryResult.error || linkedResult.error || (!primaryResult.data?.length && !linkedResult.data?.length)) {
      throw unavailableFileError();
    }
    return;
  }

  const { data: attachment, error } = await admin
    .from('ArchivoAdjunto')
    .select('id,ordenTrabajoActividadId,tecnicoId')
    .eq('r2Key', key)
    .maybeSingle();
  if (error || !attachment) throw unavailableFileError();

  if (attachment.ordenTrabajoActividadId) {
    const { data: activity, error: activityError } = await admin
      .from('OrdenTrabajoActividad')
      .select('id,tecnicoId')
      .eq('id', attachment.ordenTrabajoActividadId)
      .maybeSingle();
    if (activityError || Number(activity?.tecnicoId) !== Number(user.tecnicoId)) {
      throw unavailableFileError();
    }
    return;
  }

  if (Number(attachment.tecnicoId) !== Number(user.tecnicoId)) throw unavailableFileError();
}

export async function GET(request) {
  try {
    const user = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const key = normalizeKey(searchParams.get('key') || searchParams.get('url'));

    if (!key) {
      return NextResponse.json({ error: 'Archivo no disponible.' }, { status: 404 });
    }

    await assertCanReadKey(user, key);
    const range = normalizeRange(request.headers.get('range'));
    const object = await getObjectStreamFromR2({ key, range });
    const contentType = normalizedContentType(object.contentType);
    const inline = INLINE_CONTENT_TYPES.has(contentType);
    const filename = safeDownloadName(key);

    return new NextResponse(object.stream, {
      status: object.contentRange ? 206 : 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Content-Type': contentType,
        ...(object.contentLength ? { 'Content-Length': String(object.contentLength) } : {}),
        ...(object.contentRange ? { 'Content-Range': object.contentRange } : {}),
        ...(object.etag ? { ETag: object.etag } : {}),
        ...(!inline ? { 'Content-Security-Policy': "sandbox; default-src 'none'" } : {}),
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = error?.status === 401 ? 401 : 404;
    return NextResponse.json(
      { error: status === 401 ? 'No autenticado.' : 'Archivo no disponible.' },
      { status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
