import type { OfflineUserContext } from './types';

const ACTIVE_USER_KEY = 'cmcing.offline.active-user.v1';
const USER_EVENT = 'cmcing:offline-user-changed';
let activeUser: OfflineUserContext | null | undefined;
let sessionRequest: Promise<OfflineUserContext | null> | null = null;
let verifiedThisPage = false;

function normalizeUser(value: unknown): OfflineUserContext | null {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value).trim();
    return id ? { id, userId: id } : null;
  }

  if (typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const userId = String(source.userId || source.id || '').trim();
  const tenantId = String(source.tenantId || '').trim();
  if (!userId) return null;
  const id = tenantId
    ? `tenant:${encodeURIComponent(tenantId)}:user:${encodeURIComponent(userId)}`
    : userId;
  return {
    id,
    userId,
    tenantId: tenantId || undefined,
    technicianId: source.tecnicoId === undefined || source.tecnicoId === null
      ? undefined
      : String(source.tecnicoId),
    email: source.email ? String(source.email).trim().toLowerCase() : undefined,
    verifiedAt: Number(source.verifiedAt) || undefined,
  };
}

export function configureOfflinePartition(input: {
  tenantId?: string;
  userId: string | number;
  technicianId?: string | number | null;
  email?: string;
}): OfflineUserContext {
  return setActiveOfflineUser(input);
}

function readPersistedUser(): OfflineUserContext | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return normalizeUser(JSON.parse(localStorage.getItem(ACTIVE_USER_KEY) || 'null'));
  } catch {
    localStorage.removeItem(ACTIVE_USER_KEY);
    return null;
  }
}

export function getActiveOfflineUser(): OfflineUserContext | null {
  if (activeUser === undefined) activeUser = readPersistedUser();
  return activeUser;
}

export function setActiveOfflineUser(value: unknown): OfflineUserContext {
  const user = normalizeUser(value);
  if (!user) throw new Error('Se requiere un identificador de usuario para habilitar el modo offline.');
  activeUser = { ...user, verifiedAt: user.verifiedAt || Date.now() };
  verifiedThisPage = true;
  if (typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(activeUser));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(USER_EVENT, { detail: activeUser }));
  return activeUser;
}

export function clearActiveOfflineUser(expectedUserId?: string): void {
  const current = getActiveOfflineUser();
  if (expectedUserId && current?.id !== expectedUserId) return;
  activeUser = null;
  verifiedThisPage = false;
  if (typeof localStorage !== 'undefined') localStorage.removeItem(ACTIVE_USER_KEY);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(USER_EVENT, { detail: null }));
}

export async function refreshOfflineUserFromSession(): Promise<OfflineUserContext | null> {
  if (sessionRequest) return sessionRequest;
  if (typeof fetch === 'undefined') return getActiveOfflineUser();

  sessionRequest = fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  }).then(async (response) => {
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(`No se pudo verificar la sesion offline (${response.status}).`);
    const data = await response.json();
    if (!data?.user) return null;
    const current = getActiveOfflineUser();
    const sessionUserId = String(data.user.id || '');
    const tenantId = current?.userId === sessionUserId ? current.tenantId : undefined;
    return setActiveOfflineUser({ ...data.user, userId: sessionUserId, tenantId });
  }).finally(() => {
    sessionRequest = null;
  });

  return sessionRequest;
}

export async function requireOfflineUser(): Promise<OfflineUserContext> {
  const current = getActiveOfflineUser();
  if (current && (verifiedThisPage || (typeof navigator !== 'undefined' && navigator.onLine === false))) return current;
  if (current && typeof navigator === 'undefined') return current;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('No hay una sesion offline vinculada a este dispositivo. Conectate e inicia sesion una vez.');
  }
  const user = await refreshOfflineUserFromSession();
  if (!user) throw new Error('No hay una sesion autenticada para guardar datos offline.');
  return user;
}

export const OFFLINE_USER_CHANGED_EVENT = USER_EVENT;
