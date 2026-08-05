import { NextResponse } from 'next/server';
import { assertActivityAccess } from '../../../lib/activity-access';
import { routeError } from '../../../lib/api-response';
import { getOpenAINotesStatus, improveTechnicalNotes } from '../../../lib/openai-notes';
import { requireRequestUser } from '../../../lib/request-auth';
import { getActividadTrabajo } from '../../../lib/service-work-store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getOpenAINotesStatus());
}

export async function POST(request) {
  try {
    const user = await requireRequestUser(request);
    const body = await request.json();
    const activity = await getActividadTrabajo(body.actividadId);
    if (!activity) return NextResponse.json({ error: 'Actividad no encontrada.' }, { status: 404 });
    assertActivityAccess(user, activity, { write: true });
    if (activity.bloqueada) return NextResponse.json({ error: 'La actividad está cerrada y no admite cambios.' }, { status: 409 });
    return NextResponse.json(await improveTechnicalNotes({ notes: body.notas, activity }));
  } catch (error) {
    return routeError(error);
  }
}
