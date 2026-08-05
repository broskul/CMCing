import { NextResponse } from 'next/server';
import { assertActivityAccess } from '../../../../lib/activity-access';
import { routeError } from '../../../../lib/api-response';
import { buildActivityCompliancePdf } from '../../../../lib/compliance-reporting';
import { getObjectFromR2 } from '../../../../lib/r2';
import { getActividadTrabajo } from '../../../../lib/service-work-store';
import { requireRequestUser } from '../../../../lib/request-auth';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  try {
    const user = await requireRequestUser(_request);
    const { id } = await params;
    const activity = await getActividadTrabajo(id);
    if (!activity) return NextResponse.json({ error: 'Actividad no encontrada.' }, { status: 404 });
    assertActivityAccess(user, activity);
    const images = [];
    for (const attachment of activity.adjuntos.filter((item) => String(item.mimeType || '').startsWith('image/'))) {
      try {
        const object = await getObjectFromR2({ key: attachment.r2Key });
        images.push({ ...attachment, ...object });
      } catch {
        // El informe sigue siendo válido aunque una evidencia histórica no esté disponible.
      }
    }
    const bytes = await buildActivityCompliancePdf(activity, images);
    const filename = `${activity.ordenTrabajo?.codigo || 'OT'}-actividad-${activity.id}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
