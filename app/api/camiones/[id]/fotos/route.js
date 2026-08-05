import { NextResponse } from 'next/server';
import {
  buildDeterministicR2Key,
  detectImageMimeType,
  sha256Buffer,
  uploadBufferToR2,
} from '../../../../lib/r2';
import { routeError } from '../../../../lib/api-response';
import { requireRequestRole } from '../../../../lib/request-auth';
import { createCamionFoto, getCamion } from '../../../../lib/supabase-store';

export const runtime = 'nodejs';

const INTERNAL_ERROR = 'No fue posible registrar la fotografía del camión.';

export async function POST(request, { params }) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const { id } = await params;
    const camion = await getCamion(id);
    if (!camion) return NextResponse.json({ error: 'Camión no encontrado.' }, { status: 404 });

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
    const clientActionId = /^[0-9a-f-]{16,64}$/i.test(rawClientActionId)
      ? rawClientActionId
      : checksumSha256.slice(0, 32);
    const upload = await uploadBufferToR2({
      buffer,
      key: buildDeterministicR2Key({
        prefix: `private/camiones/${camion.id}`,
        clientActionId,
        checksumSha256,
        filename: file.name || `camion-${camion.patente || camion.id}.jpg`,
      }),
      contentType: detectedMimeType,
    });
    // No se hace un DELETE compensatorio de R2 si falla el registro. Una
    // solicitud concurrente puede haber ganado CamionFoto_r2Key_key y estar
    // referenciando ya este mismo objeto. El registro recupera esa fila.
    const foto = await createCamionFoto(camion.id, {
      tipo: String(formData.get('tipo') || 'foto').slice(0, 80),
      titulo: String(formData.get('titulo') || '').trim().slice(0, 180),
      observaciones: String(formData.get('observaciones') || '').trim().slice(0, 1000),
      nombreOriginal: file.name || 'foto-camion',
      mimeType: detectedMimeType,
      sizeBytes: buffer.length,
      r2Bucket: upload.bucket,
      r2Key: upload.key,
      checksumSha256: upload.checksumSha256,
    });

    return NextResponse.json(foto, { status: 201 });
  } catch (error) {
    return routeError(error, { internalMessage: INTERNAL_ERROR });
  }
}
