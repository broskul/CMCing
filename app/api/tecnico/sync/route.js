import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';
import {
  assertTechnicianAppRole,
  classifyTechnicianApiError,
  getTechnicianSessionUser,
  technicianSyncSchema,
  zodErrorPayload,
} from '../../../lib/technician-api';

export const dynamic = 'force-dynamic';

function rpcForMutation(mutation) {
  const common = {
    p_actividad_id: mutation.activityId,
    p_client_mutation_id: mutation.clientMutationId,
    p_expected_revision: mutation.expectedRevision,
  };
  if (mutation.operation === 'ACTUALIZAR_NOTAS') {
    return ['cmc_actualizar_notas_actividad', { ...common, p_notas: mutation.payload.notes }];
  }
  if (mutation.operation === 'GUARDAR_RESPUESTAS') {
    return ['cmc_guardar_respuestas_matriz', {
      ...common,
      p_asignacion_id: mutation.payload.assignmentId,
      p_respuestas: mutation.payload.answers,
    }];
  }
  return ['cmc_cerrar_actividad', common];
}

export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const authResult = await supabase.auth.getUser();
    if (authResult.error || !authResult.data.user) {
      return NextResponse.json({
        error: 'No autenticado.', code: 'AUTH_REQUIRED', retryable: false,
      }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const user = await getTechnicianSessionUser(supabase, authResult.data.user);
    assertTechnicianAppRole(user, { write: true });

    const parsed = technicianSyncSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(zodErrorPayload(parsed.error), {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const [rpc, parameters] = rpcForMutation(parsed.data);
    const result = await supabase.rpc(rpc, parameters);
    if (result.error) throw result.error;
    const response = result.data || {};
    if (response.status === 'conflict') {
      return NextResponse.json({
        ...response,
        conflict: true,
        retryable: false,
        error: 'La actividad cambio en el servidor. Revise el conflicto antes de continuar.',
      }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ ...response, retryable: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const classified = classifyTechnicianApiError(error);
    return NextResponse.json({
      error: classified.message,
      code: classified.code,
      retryable: classified.retryable,
      retryAfterMs: classified.retryAfterMs,
    }, {
      status: classified.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(classified.retryAfterMs ? { 'Retry-After': String(Math.ceil(classified.retryAfterMs / 1000)) } : {}),
      },
    });
  }
}
