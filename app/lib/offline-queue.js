'use client';

import {
  completeOutboxEntry,
  computeOfflineRetryDelay,
  createOfflineUuid,
  enqueueOutbox,
  initializeOfflineStorage,
  listOutboxEntries,
  requireOfflineUser,
  updateOutboxEntry,
} from './offline';

async function resolveLegacyOptions(options = {}) {
  if (options.userId) return options;
  const user = await requireOfflineUser();
  await initializeOfflineStorage(user);
  return { ...options, userId: user.id };
}

function toLegacyStatus(status) {
  if (status === 'running') return 'syncing';
  if (status === 'failed' || status === 'blocked') return 'error';
  return 'pending';
}

function toLegacyJob(record) {
  return {
    id: record.id,
    status: toLegacyStatus(record.status),
    attempts: record.attempts || 0,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
    error: record.lastError || '',
    payload: record.payload,
    dependsOn: record.dependsOn || [],
    baseRevision: record.baseRevision ?? null,
    idempotencyKey: record.idempotencyKey,
  };
}

export async function enqueueSyncJob(payload, options = {}) {
  const scopedOptions = await resolveLegacyOptions(options);
  const clientMutationId = payload?.clientMutationId || createOfflineUuid();
  const record = await enqueueOutbox({
    id: clientMutationId,
    clientMutationId,
    idempotencyKey: scopedOptions.idempotencyKey || clientMutationId,
    operation: scopedOptions.operation || 'legacy.technician-sync',
    entity: scopedOptions.entity || 'visita',
    entityId: scopedOptions.entityId,
    payload: { ...payload, clientMutationId },
    dependsOn: scopedOptions.dependsOn || payload?.dependsOn || [],
    baseRevision: scopedOptions.baseRevision ?? payload?.baseRevision ?? null,
  }, scopedOptions);
  const [hydrated] = await listOutboxEntries({
    userId: record.userId,
    rehydrate: 'data-url',
    statuses: [record.status],
  }).then((records) => records.filter((item) => item.id === record.id));
  return toLegacyJob(hydrated || record);
}

export async function listSyncJobs(options = {}) {
  const scopedOptions = await resolveLegacyOptions(options);
  const records = await listOutboxEntries({
    userId: scopedOptions.userId,
    rehydrate: 'data-url',
    statuses: ['pending', 'running', 'failed', 'blocked'],
  });
  return records.map(toLegacyJob);
}

export async function updateSyncJob(id, patch, options = {}) {
  const scopedOptions = await resolveLegacyOptions(options);
  const status = patch.status === 'syncing'
    ? 'running'
    : patch.status === 'error'
      ? 'failed'
      : patch.status === 'pending'
        ? 'pending'
        : undefined;
  const attempts = patch.attempts === undefined ? undefined : Number(patch.attempts);
  const nextAttemptAt = status === 'failed'
    ? Date.now() + computeOfflineRetryDelay(Math.max(1, attempts || 1))
    : patch.nextAttemptAt;
  const record = await updateOutboxEntry(id, {
    ...(status ? { status } : {}),
    ...(attempts === undefined ? {} : { attempts }),
    ...(nextAttemptAt === undefined ? {} : { nextAttemptAt }),
    ...(patch.error === undefined ? {} : { lastError: String(patch.error || '') }),
    ...(status === 'running' ? { leaseUntil: Date.now() + 60_000 } : {}),
    ...(status === 'failed' || status === 'pending' ? { leaseUntil: null } : {}),
  }, scopedOptions);
  if (!record) return null;
  const [hydrated] = await listOutboxEntries({ userId: record.userId, rehydrate: 'data-url' })
    .then((records) => records.filter((item) => item.id === record.id));
  return toLegacyJob(hydrated || record);
}

// The historical caller only invokes delete after the server acknowledged the mutation.
// A compact completion marker is retained so dependsOn can distinguish success from discard.
export async function deleteSyncJob(id, options = {}) {
  const scopedOptions = await resolveLegacyOptions(options);
  return completeOutboxEntry(id, scopedOptions);
}

export * from './offline';
