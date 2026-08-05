import { resolveAppUser } from './auth';
import { createSupabaseServerClient } from './supabase-auth-server';

export async function getRequestUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return resolveAppUser(data.user);
}

export async function requireRequestUser() {
  const user = await getRequestUser();
  if (!user) {
    const error = new Error('No autenticado.');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  return user;
}

export async function requireRequestRole(_request, allowedRoles) {
  const user = await requireRequestUser();
  const allowed = new Set((allowedRoles || []).map((role) => String(role).toUpperCase()));
  const role = String(user.rol || '').toUpperCase();
  const superadminAsAdmin = role === 'SUPERADMIN' && allowed.has('ADMIN');

  if (!allowed.has(role) && !superadminAsAdmin) {
    const error = new Error('No tiene permisos para realizar esta acción.');
    error.status = 403;
    error.code = 'AUTH_ROLE_REQUIRED';
    throw error;
  }
  return user;
}

export function jsonErrorStatus(error) {
  if (Number.isInteger(error?.status)) return error.status;
  if (error?.code === '23505') return 409;
  if (error?.code === '23503') return 400;
  return 500;
}
