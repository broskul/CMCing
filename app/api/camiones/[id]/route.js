import { NextResponse } from 'next/server';
import { routeError } from '../../../lib/api-response';
import { deleteObjectFromR2 } from '../../../lib/r2';
import { requireRequestRole, requireRequestUser } from '../../../lib/request-auth';
import { deleteEntity, getCamion, updateEntity } from '../../../lib/supabase-store';

const INTERNAL_ERROR = 'No fue posible procesar la solicitud del camión.';

export async function GET(request, { params }) {
  try {
    await requireRequestUser(request);
    const { id } = await params;
    const camion = await getCamion(id);
    if (!camion) return NextResponse.json({ error: 'Camión no encontrado.' }, { status: 404 });
    return NextResponse.json(camion);
  } catch (error) {
    return routeError(error, { internalMessage: INTERNAL_ERROR });
  }
}

export async function PUT(request, { params }) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const { id } = await params;
    const camion = await updateEntity('camiones', id, await request.json());
    if (!camion) return NextResponse.json({ error: 'Camión no encontrado.' }, { status: 404 });
    return NextResponse.json(camion);
  } catch (error) {
    return routeError(error, { internalMessage: INTERNAL_ERROR });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const { id } = await params;
    const camion = await getCamion(id);
    if (!camion) return NextResponse.json({ error: 'Camión no encontrado.' }, { status: 404 });

    const r2Keys = [...new Set(
      (camion.fotos || [])
        .map((foto) => String(foto.r2Key || '').trim())
        .filter(Boolean),
    )];

    const deleted = await deleteEntity('camiones', id);
    if (!deleted) return NextResponse.json({ error: 'Camión no encontrado.' }, { status: 404 });

    // La base de datos se elimina primero: nunca se pierde evidencia si el
    // DELETE relacional falla. R2 se limpia sólo después del éxito confirmado.
    const cleanupResults = await Promise.allSettled(
      r2Keys.map((key) => deleteObjectFromR2({ key })),
    );
    const cleanupFailures = cleanupResults.filter((result) => result.status === 'rejected').length;

    return NextResponse.json({
      message: 'Camión eliminado.',
      almacenamiento: {
        objetosDetectados: r2Keys.length,
        objetosEliminados: r2Keys.length - cleanupFailures,
        limpiezaPendiente: cleanupFailures > 0,
      },
      ...(cleanupFailures > 0
        ? { warning: 'El camión fue eliminado, pero parte de la limpieza de archivos R2 requiere reconciliación.' }
        : {}),
    });
  } catch (error) {
    return routeError(error, { internalMessage: INTERNAL_ERROR });
  }
}
