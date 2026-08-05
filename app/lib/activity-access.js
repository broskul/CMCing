function accessError(message, status = 403, code = 'ACTIVITY_ACCESS_DENIED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function assertActivityAccess(user, activity, { write = false, adminOnly = false } = {}) {
  if (!user) throw accessError('No autenticado.', 401, 'AUTH_REQUIRED');
  if (!activity) throw accessError('Actividad no encontrada.', 404, 'ACTIVITY_NOT_FOUND');

  const role = String(user.rol || '').toUpperCase();
  if (adminOnly) {
    if (!['SUPERADMIN', 'ADMIN'].includes(role)) {
      throw accessError('Esta acción requiere un administrador.', 403, 'AUTH_ROLE_REQUIRED');
    }
    return activity;
  }

  if (role === 'TECNICO') {
    if (!user.tecnicoId || Number(user.tecnicoId) !== Number(activity.tecnicoId)) {
      throw accessError('La actividad no está asignada a este técnico.');
    }
    return activity;
  }

  const allowed = write
    ? ['SUPERADMIN', 'ADMIN', 'OPERACIONES']
    : ['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA'];
  if (!allowed.includes(role)) {
    throw accessError('No tiene permisos para acceder a esta actividad.');
  }
  return activity;
}
