import { z } from 'zod';

const mutationIdSchema = z.string()
  .trim()
  .min(8, 'clientMutationId debe tener al menos 8 caracteres.')
  .max(200, 'clientMutationId supera el maximo permitido.')
  .regex(/^[A-Za-z0-9._:-]+$/, 'clientMutationId contiene caracteres no permitidos.');

const activityIdSchema = z.coerce.number().int().positive();
const revisionSchema = z.coerce.number().int().positive();
const jsonOptionSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
]);

const matrixAnswerSchema = z.object({
  matrizItemId: activityIdSchema,
  valorNumero: z.number().finite().optional(),
  valorBooleano: z.boolean().optional(),
  valorTexto: z.string().trim().min(1).max(10_000).optional(),
  valorOpciones: z.array(jsonOptionSchema).min(1).max(100).optional(),
}).strict().superRefine((answer, context) => {
  const values = [answer.valorNumero, answer.valorBooleano, answer.valorTexto, answer.valorOpciones]
    .filter((value) => value !== undefined);
  if (values.length !== 1) {
    context.addIssue({
      code: 'custom',
      message: 'Cada respuesta debe contener exactamente un valor.',
    });
  }
});

const baseMutation = {
  clientMutationId: mutationIdSchema,
  activityId: activityIdSchema,
  expectedRevision: revisionSchema,
};

export const technicianSyncSchema = z.discriminatedUnion('operation', [
  z.object({
    ...baseMutation,
    operation: z.literal('ACTUALIZAR_NOTAS'),
    payload: z.object({ notes: z.string().max(20_000) }).strict(),
  }).strict(),
  z.object({
    ...baseMutation,
    operation: z.literal('GUARDAR_RESPUESTAS'),
    payload: z.object({
      assignmentId: activityIdSchema,
      answers: z.array(matrixAnswerSchema).min(1).max(500),
    }).strict().superRefine((payload, context) => {
      const unique = new Set(payload.answers.map((answer) => answer.matrizItemId));
      if (unique.size !== payload.answers.length) {
        context.addIssue({ code: 'custom', message: 'Hay items de matriz duplicados.' });
      }
    }),
  }).strict(),
  z.object({
    ...baseMutation,
    operation: z.literal('CERRAR_ACTIVIDAD'),
    payload: z.object({}).strict().optional().default({}),
  }).strict(),
]);

export function assertTechnicianAppRole(user, { write = false } = {}) {
  const role = String(user?.rol || '').toUpperCase();
  const allowed = write
    ? ['TECNICO', 'SUPERADMIN', 'ADMIN', 'OPERACIONES']
    : ['TECNICO', 'SUPERADMIN', 'ADMIN', 'OPERACIONES'];
  if (!allowed.includes(role)) {
    const error = new Error(write
      ? 'El usuario no puede modificar actividades desde la app tecnica.'
      : 'El usuario no tiene acceso a la app tecnica.');
    error.status = 403;
    error.code = 'TECHNICIAN_APP_FORBIDDEN';
    throw error;
  }
  if (role === 'TECNICO' && !user?.tecnicoId) {
    const error = new Error('El perfil tecnico no tiene un tecnico asociado.');
    error.status = 403;
    error.code = 'TECHNICIAN_PROFILE_UNLINKED';
    throw error;
  }
  return role;
}

export async function getTechnicianSessionUser(supabase, authUser) {
  const authUserId = String(authUser?.id || '').trim();
  if (!authUserId) {
    const error = new Error('La sesión Supabase no contiene un usuario válido.');
    error.status = 401;
    error.code = 'AUTH_IDENTITY_INVALID';
    throw error;
  }
  const result = await supabase
    .from('Usuario')
    .select('id,nombre,email,rol,tecnicoId,activo,authUserId')
    .eq('authUserId', authUserId)
    .eq('activo', true)
    .maybeSingle();
  if (result.error) {
    const error = new Error(`No se pudo resolver el perfil técnico: ${result.error.message}`);
    error.code = result.error.code;
    throw error;
  }
  if (!result.data) {
    const error = new Error('La sesión no está vinculada a un perfil CMCing activo.');
    error.status = 403;
    error.code = 'AUTH_PROFILE_MISSING';
    throw error;
  }
  return {
    ...result.data,
    authUserId,
    email: String(result.data.email || authUser.email || '').trim().toLowerCase(),
    rol: String(result.data.rol || '').toUpperCase(),
  };
}

export function requireSupabaseData(result, label) {
  if (result.error) {
    const error = new Error(`${label}: ${result.error.message}`);
    error.code = result.error.code;
    error.details = result.error.details;
    error.hint = result.error.hint;
    throw error;
  }
  return result.data || [];
}

export function classifyTechnicianApiError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || 'Error interno de sincronizacion.');
  if (Number.isInteger(error?.status)) {
    return { status: error.status, retryable: error.status >= 500, code: code || 'REQUEST_ERROR', message };
  }
  if (code === '42501') return { status: 403, retryable: false, code, message };
  if (code === 'P0002') return { status: 404, retryable: false, code, message };
  if (['22023', '23502', '23503', '23514'].includes(code)) {
    return { status: 400, retryable: false, code, message };
  }
  if (code === '23505') return { status: 409, retryable: false, code, message };
  if (code === '55000') {
    const processing = /continua en proceso|reintente/i.test(message);
    return { status: 409, retryable: processing, code, message, retryAfterMs: processing ? 2000 : undefined };
  }
  if (['40001', '40P01', '55P03', '57014', 'PGRST000', 'PGRST001', 'PGRST002'].includes(code)) {
    return { status: 503, retryable: true, code, message };
  }
  return { status: 503, retryable: true, code: code || 'SYNC_UNAVAILABLE', message };
}

export function zodErrorPayload(error) {
  return {
    error: 'Payload de sincronizacion invalido.',
    code: 'VALIDATION_ERROR',
    retryable: false,
    issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  };
}
