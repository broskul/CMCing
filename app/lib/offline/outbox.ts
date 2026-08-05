import {
  buildScopedKey,
  collectOfflineBlobIds,
  createOfflineUuid,
  extractOfflineBlobs,
  rehydrateOfflineBlobs,
} from './codec';
import { offlineDb } from './database';
import { requireOfflineUser } from './user';
import type {
  EnqueueOutboxInput,
  OfflineBlobRecord,
  OfflineOutboxRecord,
  OfflineRehydrateMode,
  OfflineSyncHandler,
} from './types';

const COMPLETED_META_PREFIX = 'outbox-completed:';
const DEFAULT_LEASE_MS = 60_000;
const localLocks = new Map<string, Promise<unknown>>();

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Error de sincronizacion.');
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 1000);
}

async function loadBlobMap(userId: string, payload: unknown): Promise<Map<string, OfflineBlobRecord>> {
  const ids = collectOfflineBlobIds(payload);
  if (!ids.length) return new Map();
  const records = await offlineDb.blobs.bulkGet(ids.map((id) => buildScopedKey(userId, id)));
  return new Map(records.filter(Boolean).map((record) => [record!.id, record!]));
}

async function deleteOutboxBlobs(userId: string, ownerId: string): Promise<void> {
  const records = await offlineDb.blobs
    .where('[userId+ownerType+ownerId]')
    .equals([userId, 'outbox', ownerId])
    .toArray();
  if (records.length) await offlineDb.blobs.bulkDelete(records.map((record) => record.key));
}

export function computeOfflineRetryDelay(
  attempts: number,
  options: { baseMs?: number; capMs?: number; jitter?: number; random?: () => number } = {},
): number {
  const baseMs = Math.max(250, options.baseMs ?? 2_000);
  const capMs = Math.max(baseMs, options.capMs ?? 5 * 60_000);
  const jitter = Math.min(1, Math.max(0, options.jitter ?? 0.2));
  const exponential = Math.min(capMs, baseMs * (2 ** Math.max(0, attempts - 1)));
  const random = (options.random || Math.random)();
  return Math.round(exponential * ((1 - jitter) + (random * jitter * 2)));
}

export async function enqueueOutbox<T>(
  input: EnqueueOutboxInput<T>,
  options: { userId?: string } = {},
): Promise<OfflineOutboxRecord<T>> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const id = String(input.id || input.clientMutationId || createOfflineUuid());
  const idempotencyKey = String(input.idempotencyKey || input.clientMutationId || id);
  const operation = String(input.operation || '').trim();
  if (!operation) throw new Error('La mutacion offline requiere operation.');

  const existing = await offlineDb.outbox
    .where('[userId+idempotencyKey]')
    .equals([user.id, idempotencyKey])
    .first();
  if (existing) return existing as OfflineOutboxRecord<T>;

  const extracted = await extractOfflineBlobs(input.payload, { userId: user.id, ownerType: 'outbox', ownerId: id });
  const now = Date.now();
  const record: OfflineOutboxRecord = {
    key: buildScopedKey(user.id, id),
    id,
    userId: user.id,
    idempotencyKey,
    operation,
    entity: input.entity ? String(input.entity) : undefined,
    entityId: input.entityId === undefined || input.entityId === null ? undefined : String(input.entityId),
    payload: extracted.payload,
    dependsOn: Array.from(new Set((input.dependsOn || []).map(String).filter(Boolean))),
    baseRevision: input.baseRevision ?? null,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    leaseUntil: null,
    lastError: '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await offlineDb.transaction('rw', offlineDb.outbox, offlineDb.blobs, async () => {
      if (extracted.blobs.length) await offlineDb.blobs.bulkPut(extracted.blobs);
      await offlineDb.outbox.add(record);
    });
  } catch (error) {
    if ((error as { name?: string })?.name !== 'ConstraintError') throw error;
    const raced = await offlineDb.outbox
      .where('[userId+idempotencyKey]')
      .equals([user.id, idempotencyKey])
      .first();
    if (raced) return raced as OfflineOutboxRecord<T>;
    throw error;
  }
  return record as OfflineOutboxRecord<T>;
}

export async function getOutboxEntry<T = unknown>(
  id: string,
  options: { userId?: string; rehydrate?: OfflineRehydrateMode } = {},
): Promise<OfflineOutboxRecord<T> | null> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const record = await offlineDb.outbox.get(buildScopedKey(user.id, String(id)));
  if (!record) return null;
  const blobs = await loadBlobMap(user.id, record.payload);
  return {
    ...record,
    payload: await rehydrateOfflineBlobs(record.payload, blobs, options.rehydrate) as T,
  };
}

export async function listOutboxEntries<T = unknown>(options: {
  userId?: string;
  rehydrate?: OfflineRehydrateMode;
  statuses?: OfflineOutboxRecord['status'][];
} = {}): Promise<Array<OfflineOutboxRecord<T>>> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  let records = await offlineDb.outbox.where('userId').equals(user.id).sortBy('createdAt');
  if (options.statuses?.length) records = records.filter((record) => options.statuses!.includes(record.status));
  return Promise.all(records.map(async (record) => {
    const blobs = await loadBlobMap(user.id, record.payload);
    return {
      ...record,
      payload: await rehydrateOfflineBlobs(record.payload, blobs, options.rehydrate) as T,
    };
  }));
}

export async function updateOutboxEntry(
  id: string,
  patch: Partial<Pick<OfflineOutboxRecord, 'status' | 'attempts' | 'nextAttemptAt' | 'leaseUntil' | 'lastError'>>,
  options: { userId?: string } = {},
): Promise<OfflineOutboxRecord | null> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const key = buildScopedKey(user.id, String(id));
  const current = await offlineDb.outbox.get(key);
  if (!current) return null;
  const next = { ...current, ...patch, key, userId: user.id, updatedAt: Date.now() };
  await offlineDb.outbox.put(next);
  return next;
}

async function markCompletion(userId: string, id: string, idempotencyKey: string): Promise<void> {
  const name = `${COMPLETED_META_PREFIX}${id}`;
  await offlineDb.meta.put({
    key: buildScopedKey(userId, name),
    userId,
    name,
    value: { id, idempotencyKey, completedAt: Date.now() },
    updatedAt: Date.now(),
  });
}

export async function completeOutboxEntry(id: string, options: { userId?: string } = {}): Promise<boolean> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const key = buildScopedKey(user.id, String(id));
  const current = await offlineDb.outbox.get(key);
  if (!current) return false;
  await offlineDb.transaction('rw', offlineDb.outbox, offlineDb.blobs, offlineDb.meta, async () => {
    await markCompletion(user.id, current.id, current.idempotencyKey);
    await offlineDb.outbox.delete(key);
    await deleteOutboxBlobs(user.id, current.id);
  });
  return true;
}

export async function discardOutboxEntry(id: string, options: { userId?: string } = {}): Promise<boolean> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const key = buildScopedKey(user.id, String(id));
  const exists = await offlineDb.outbox.get(key);
  if (!exists) return false;
  await offlineDb.transaction('rw', offlineDb.outbox, offlineDb.blobs, async () => {
    await offlineDb.outbox.delete(key);
    await deleteOutboxBlobs(user.id, exists.id);
  });
  return true;
}

async function dependencyState(userId: string, dependencyId: string): Promise<'complete' | 'waiting' | 'missing'> {
  const active = await offlineDb.outbox.get(buildScopedKey(userId, dependencyId));
  if (active) return 'waiting';
  const completed = await offlineDb.meta.get(buildScopedKey(userId, `${COMPLETED_META_PREFIX}${dependencyId}`));
  return completed ? 'complete' : 'missing';
}

async function withLocalLock<T>(name: string, task: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
  if (localLocks.has(name)) return { acquired: false };
  const promise = task();
  localLocks.set(name, promise);
  try {
    return { acquired: true, value: await promise };
  } finally {
    localLocks.delete(name);
  }
}

export async function withOfflineSyncLock<T>(
  userId: string,
  task: () => Promise<T>,
): Promise<{ acquired: boolean; value?: T }> {
  const name = `cmcing-offline-sync:${userId}`;
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    let acquired = false;
    let value: T | undefined;
    await navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) return;
      acquired = true;
      value = await task();
    });
    return { acquired, value };
  }
  return withLocalLock(name, task);
}

export async function syncOutbox(
  handler: OfflineSyncHandler,
  options: {
    userId?: string;
    limit?: number;
    leaseMs?: number;
    signal?: AbortSignal;
    now?: () => number;
  } = {},
): Promise<{ acquired: boolean; processed: number; succeeded: number; failed: number; blocked: number }> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { acquired: false, processed: 0, succeeded: 0, failed: 0, blocked: 0 };
  }
  const now = options.now || Date.now;
  const limit = Math.max(1, Math.min(100, options.limit || 20));

  const locked = await withOfflineSyncLock(user.id, async () => {
    const summary = { processed: 0, succeeded: 0, failed: 0, blocked: 0 };
    const timestamp = now();
    const candidates = (await offlineDb.outbox.where('userId').equals(user.id).sortBy('createdAt'))
      .filter((entry) => (
        ['pending', 'failed', 'running'].includes(entry.status)
        && entry.nextAttemptAt <= timestamp
        && (!entry.leaseUntil || entry.leaseUntil <= timestamp)
      ))
      .slice(0, limit);

    for (const candidate of candidates) {
      if (options.signal?.aborted) break;
      let waiting = false;
      let missing = false;
      for (const dependencyId of candidate.dependsOn) {
        const state = await dependencyState(user.id, dependencyId);
        waiting ||= state === 'waiting';
        missing ||= state === 'missing';
      }
      if (missing) {
        await updateOutboxEntry(candidate.id, {
          status: 'blocked',
          leaseUntil: null,
          lastError: 'Dependencia offline inexistente o descartada.',
        }, { userId: user.id });
        summary.blocked += 1;
        continue;
      }
      if (waiting) continue;

      const attempts = candidate.attempts + 1;
      await updateOutboxEntry(candidate.id, {
        status: 'running',
        attempts,
        leaseUntil: timestamp + (options.leaseMs || DEFAULT_LEASE_MS),
        lastError: '',
      }, { userId: user.id });
      summary.processed += 1;

      try {
        const hydrated = await getOutboxEntry(candidate.id, { userId: user.id, rehydrate: 'original' });
        if (!hydrated) continue;
        const result = await handler(hydrated, { signal: options.signal });
        if (result && result.ok === false) {
          const error = new Error(result.error || 'El servidor rechazo la sincronizacion.') as Error & {
            retryable?: boolean;
            retryAfterMs?: number;
          };
          error.retryable = result.retryable;
          error.retryAfterMs = result.retryAfterMs;
          throw error;
        }
        await completeOutboxEntry(candidate.id, { userId: user.id });
        summary.succeeded += 1;
      } catch (error) {
        const retryable = (error as { retryable?: boolean })?.retryable !== false;
        const retryAfterMs = Number((error as { retryAfterMs?: number })?.retryAfterMs);
        const delay = Number.isFinite(retryAfterMs) && retryAfterMs > 0
          ? retryAfterMs
          : computeOfflineRetryDelay(attempts);
        await updateOutboxEntry(candidate.id, {
          status: retryable ? 'failed' : 'blocked',
          leaseUntil: null,
          nextAttemptAt: retryable ? now() + delay : Number.MAX_SAFE_INTEGER,
          lastError: sanitizeError(error),
        }, { userId: user.id });
        if (retryable) summary.failed += 1;
        else summary.blocked += 1;
      }
    }
    return summary;
  });

  return locked.acquired
    ? { acquired: true, ...(locked.value || { processed: 0, succeeded: 0, failed: 0, blocked: 0 }) }
    : { acquired: false, processed: 0, succeeded: 0, failed: 0, blocked: 0 };
}
