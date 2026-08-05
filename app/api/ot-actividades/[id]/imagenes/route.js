import { NextResponse } from 'next/server';
import { routeError } from '../../../../lib/api-response';
import { buildDeterministicR2Key, deleteObjectFromR2, detectImageMimeType, sha256Buffer, uploadBufferToR2 } from '../../../../lib/r2';
import { requireRequestUser } from '../../../../lib/request-auth';
import { createActividadAdjunto, getActividadTrabajo } from '../../../../lib/service-work-store';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await params;
    const activity = await getActividadTrabajo(id);
    if (!activity) return NextResponse.json({ error: 'Actividad no encontrada.' }, { status: 404 });
    const role = String(user.rol || '').toUpperCase();
    const canManage = ['SUPERADMIN', 'ADMIN', 'OPERACIONES'].includes(role);
    if (!canManage && (role !== 'TECNICO' || Number(user.tecnicoId) !== Number(activity.tecnicoId))) {
      return NextResponse.json({ error: 'La actividad no está asignada a este técnico.' }, { status: 403 });
    }
    if (activity.bloqueada) {
      return NextResponse.json({ error: 'La actividad está cerrada y no admite imágenes.' }, { status: 409 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Debe seleccionar una imagen.' }, { status: 400 });
    }
    if (!String(file.type || '').startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten archivos de imagen.' }, { status: 400 });
    }
    if (Number(file.size || 0) > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen supera el máximo de 12 MB.' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMimeType = detectImageMimeType(buffer);
    if (!detectedMimeType) {
      return NextResponse.json({ error: 'El contenido no corresponde a una imagen JPEG, PNG, WebP o GIF válida.' }, { status: 415 });
    }
    const checksumSha256 = sha256Buffer(buffer);
    const rawClientActionId = String(formData.get('clientActionId') || '').trim();
    const clientActionId = /^[0-9a-f-]{16,64}$/i.test(rawClientActionId) ? rawClientActionId : crypto.randomUUID();
    const key = buildDeterministicR2Key({
      prefix: `private/ordenes-trabajo/${activity.ordenTrabajoId}/actividades/${activity.id}`,
      clientActionId,
      checksumSha256,
      filename: file.name || 'imagen-actividad',
    });
    const upload = await uploadBufferToR2({
      buffer,
      key,
      contentType: detectedMimeType,
    });
    let attachment;
    try {
      attachment = await createActividadAdjunto(activity.id, {
        tipo: 'imagen_actividad',
        nombreOriginal: file.name || 'imagen-actividad',
        mimeType: detectedMimeType,
        sizeBytes: buffer.length,
        r2Bucket: upload.bucket,
        r2Key: upload.key,
        checksumSha256: upload.checksumSha256,
        metadata: {
          clientActionId,
          titulo: String(formData.get('titulo') || '').trim().slice(0, 180),
          descripcion: String(formData.get('descripcion') || '').trim().slice(0, 1000),
        },
      }, user);
    } catch (registrationError) {
      const refreshed = await getActividadTrabajo(activity.id).catch(() => null);
      const persisted = refreshed?.adjuntos?.some((item) => item.r2Key === upload.key);
      if (!persisted) await deleteObjectFromR2({ key: upload.key }).catch(() => null);
      throw registrationError;
    }
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
