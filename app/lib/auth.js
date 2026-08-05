import { getSupabaseAdmin } from './supabase-server';

const PROFILE_FIELDS = 'id,nombre,email,rol,tecnicoId,activo,authUserId';
const LEGACY_PROFILE_FIELDS = 'id,nombre,email,rol,tecnicoId,activo';
const EXCEPTION_EMAILS = new Set(['carlos@prof3sional.com']);

function authError(message, status = 403, code = 'AUTH_FORBIDDEN') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function identityProviders(authUser) {
  const providers = new Set();
  const addProvider = (value) => {
    const provider = String(value || '').trim().toLowerCase();
    if (provider) providers.add(provider);
  };

  addProvider(authUser?.app_metadata?.provider);
  if (Array.isArray(authUser?.app_metadata?.providers)) {
    authUser.app_metadata.providers.forEach(addProvider);
  }
  if (Array.isArray(authUser?.identities)) {
    authUser.identities.forEach((identity) => addProvider(identity?.provider));
  }
  return providers;
}

function assertAllowedAuthProvider(authUser, email) {
  const providers = identityProviders(authUser);
  const requiredProvider = EXCEPTION_EMAILS.has(email) ? 'email' : 'azure';
  const exactProvider = providers.size === 1 && providers.has(requiredProvider);

  if (!exactProvider) {
    throw authError(
      'El proveedor de identidad no está autorizado para esta cuenta.',
      403,
      'AUTH_PROVIDER_NOT_ALLOWED',
    );
  }
}

function isMissingAuthUserIdColumn(error) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('authuserid');
}

function safeProfile(profile, authUserId) {
  return {
    id: profile.id,
    authUserId,
    nombre: profile.nombre,
    email: normalizedEmail(profile.email),
    rol: String(profile.rol || 'LECTURA').toUpperCase(),
    tecnicoId: profile.tecnicoId ?? null,
    activo: Boolean(profile.activo),
  };
}

export function isAllowedAuthEmail(value) {
  const email = normalizedEmail(value);
  return Boolean(email)
    && (email.endsWith('@cmcing.cl') || EXCEPTION_EMAILS.has(email));
}

export function isPasswordAuthEmail(value) {
  return EXCEPTION_EMAILS.has(normalizedEmail(value));
}

export function safeNextPath(value, fallback = '/') {
  const candidate = String(value || '').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, 'https://cmcing.local');
    if (parsed.origin !== 'https://cmcing.local') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export async function resolveAppUser(authUser, { touchLastLogin = false } = {}) {
  const email = normalizedEmail(authUser?.email);
  const authUserId = String(authUser?.id || '').trim();

  if (!authUserId || !email) {
    throw authError('La identidad de Supabase no contiene un correo valido.', 401, 'AUTH_IDENTITY_INVALID');
  }

  if (!isAllowedAuthEmail(email)) {
    throw authError('El correo no pertenece a un dominio autorizado.', 403, 'AUTH_EMAIL_NOT_ALLOWED');
  }

  assertAllowedAuthProvider(authUser, email);

  const supabase = getSupabaseAdmin();
  let supportsAuthUserId = true;
  let profile = null;

  const byAuthId = await supabase
    .from('Usuario')
    .select(PROFILE_FIELDS)
    .eq('authUserId', authUserId)
    .maybeSingle();

  if (byAuthId.error) {
    if (!isMissingAuthUserIdColumn(byAuthId.error)) {
      throw authError('No fue posible resolver el perfil de acceso.', 503, 'AUTH_PROFILE_LOOKUP');
    }
    supportsAuthUserId = false;
  } else {
    profile = byAuthId.data;
  }

  if (!profile) {
    const byEmail = await supabase
      .from('Usuario')
      .select(supportsAuthUserId ? PROFILE_FIELDS : LEGACY_PROFILE_FIELDS)
      .ilike('email', email)
      .maybeSingle();

    if (byEmail.error) {
      throw authError('No fue posible resolver el perfil de acceso.', 503, 'AUTH_PROFILE_LOOKUP');
    }

    profile = byEmail.data;
  }

  if (!profile) {
    throw authError('La cuenta no tiene un perfil de acceso CMCing.', 403, 'AUTH_PROFILE_MISSING');
  }

  if (!profile.activo) {
    throw authError('La cuenta se encuentra deshabilitada.', 403, 'AUTH_PROFILE_INACTIVE');
  }

  if (normalizedEmail(profile.email) !== email) {
    throw authError('El correo autenticado no coincide con el perfil CMCing.', 403, 'AUTH_PROFILE_MISMATCH');
  }

  if (supportsAuthUserId && profile.authUserId && profile.authUserId !== authUserId) {
    throw authError('El perfil CMCing ya esta vinculado a otra identidad.', 403, 'AUTH_PROFILE_CONFLICT');
  }

  const update = {};
  if (supportsAuthUserId && !profile.authUserId) update.authUserId = authUserId;
  if (touchLastLogin) update.lastLoginAt = new Date().toISOString();

  if (Object.keys(update).length > 0) {
    let updateQuery = supabase.from('Usuario').update(update).eq('id', profile.id);
    if (supportsAuthUserId && !profile.authUserId) {
      updateQuery = updateQuery.is('authUserId', null);
    }
    const updateResult = await updateQuery.select(supportsAuthUserId ? PROFILE_FIELDS : LEGACY_PROFILE_FIELDS).maybeSingle();

    if (updateResult.error) {
      throw authError('No fue posible vincular la identidad al perfil.', 409, 'AUTH_PROFILE_BIND');
    }

    if (updateResult.data) {
      profile = updateResult.data;
    } else if (supportsAuthUserId && update.authUserId) {
      const currentResult = await supabase
        .from('Usuario')
        .select(PROFILE_FIELDS)
        .eq('id', profile.id)
        .maybeSingle();
      if (currentResult.error || currentResult.data?.authUserId !== authUserId) {
        throw authError('El perfil fue vinculado simultaneamente a otra identidad.', 409, 'AUTH_PROFILE_BIND');
      }
      profile = currentResult.data;
    }
  }

  return safeProfile(profile, authUserId);
}
