import { NextResponse } from 'next/server';
import { routeError } from '../../../../lib/api-response';
import { replaceEquipmentImage } from '../../../../lib/equipment-image-service';
import { requireRequestRole } from '../../../../lib/request-auth';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    await requireRequestRole(request, ['SUPERADMIN', 'ADMIN', 'OPERACIONES']);
    const { id } = await params;
    return NextResponse.json(await replaceEquipmentImage(id, await request.formData()));
  } catch (error) {
    return routeError(error, { internalMessage: 'No fue posible guardar la imagen del equipo.' });
  }
}
