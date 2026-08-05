import {
  buildScopedKey,
  collectOfflineBlobIds,
  createOfflineUuid,
  extractOfflineBlobs,
  rehydrateOfflineBlobs,
} from './codec';
import { adoptLegacyTechnicianData, offlineDb } from './database';
import { clearActiveOfflineUser, getActiveOfflineUser, requireOfflineUser } from './user';
import type {
  OfflineBlobRecord,
  OfflinePackageRecord,
  OfflineRehydrateMode,
  OfflineSnapshotRecord,
  OfflineUserContext,
} from './types';

async function loadBlobMap(userId: string, payload: unknown): Promise<Map<string, OfflineBlobRecord>> {
  const ids = collectOfflineBlobIds(payload);
  if (!ids.length) return new Map();
  const records = await offlineDb.blobs.bulkGet(ids.map((id) => buildScopedKey(userId, id)));
  return new Map(records.filter(Boolean).map((record) => [record!.id, record!]));
}

async function deleteOwnerBlobs(
  userId: string,
  ownerType: OfflineBlobRecord['ownerType'],
  ownerId: string,
  keepIds: string[] = [],
): Promise<void> {
  const keep = new Set(keepIds);
  const records = await offlineDb.blobs
    .where('[userId+ownerType+ownerId]')
    .equals([userId, ownerType, ownerId])
    .toArray();
  const keys = records.filter((record) => !keep.has(record.id)).map((record) => record.key);
  if (keys.length) await offlineDb.blobs.bulkDelete(keys);
}

export async function putOfflinePackage<T>(input: {
  id: string;
  payload: T;
  revision?: string | number | null;
  expiresAt?: number | string | Date | null;
}, options: { userId?: string } = {}): Promise<OfflinePackageRecord> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const id = String(input.id).trim();
  if (!id) throw new Error('El paquete offline requiere id.');
  const now = Date.now();
  const extracted = await extractOfflineBlobs(input.payload, { userId: user.id, ownerType: 'package', ownerId: id });
  const existing = await offlineDb.packages.get(buildScopedKey(user.id, id));
  const expiresAt = input.expiresAt instanceof Date
    ? input.expiresAt.getTime()
    : typeof input.expiresAt === 'string'
      ? Date.parse(input.expiresAt)
      : input.expiresAt;
  const record: OfflinePackageRecord = {
    key: buildScopedKey(user.id, id),
    id,
    userId: user.id,
    revision: input.revision ?? null,
    payload: extracted.payload,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    expiresAt: Number.isFinite(expiresAt) ? Number(expiresAt) : null,
  };

  await offlineDb.transaction('rw', offlineDb.packages, offlineDb.blobs, async () => {
    await deleteOwnerBlobs(user.id, 'package', id, collectOfflineBlobIds(extracted.payload));
    if (extracted.blobs.length) await offlineDb.blobs.bulkPut(extracted.blobs);
    await offlineDb.packages.put(record);
  });
  return record;
}

export async function getOfflinePackage<T = unknown>(
  id: string,
  options: { userId?: string; rehydrate?: OfflineRehydrateMode; allowExpired?: boolean } = {},
): Promise<(Omit<OfflinePackageRecord<T>, 'payload'> & { payload: T }) | null> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const record = await offlineDb.packages.get(buildScopedKey(user.id, String(id)));
  if (!record) return null;
  if (!options.allowExpired && record.expiresAt && record.expiresAt <= Date.now()) return null;
  const blobs = await loadBlobMap(user.id, record.payload);
  return { ...record, payload: await rehydrateOfflineBlobs(record.payload, blobs, options.rehydrate) as T };
}

export async function removeOfflinePackage(id: string, options: { userId?: string } = {}): Promise<void> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  await offlineDb.transaction('rw', offlineDb.packages, offlineDb.blobs, async () => {
    await offlineDb.packages.delete(buildScopedKey(user.id, String(id)));
    await deleteOwnerBlobs(user.id, 'package', String(id));
  });
}

export async function putOfflineSnapshot<T>(input: {
  entity: string;
  entityId: string | number;
  payload: T;
  revision?: string | number | null;
  baseRevision?: string | number | null;
}, options: { userId?: string } = {}): Promise<OfflineSnapshotRecord> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const entity = String(input.entity).trim();
  const entityId = String(input.entityId).trim();
  if (!entity || !entityId) throw new Error('El snapshot offline requiere entity y entityId.');
  const id = `${entity}:${entityId}`;
  const now = Date.now();
  const extracted = await extractOfflineBlobs(input.payload, { userId: user.id, ownerType: 'snapshot', ownerId: id });
  const existing = await offlineDb.snapshots.get(buildScopedKey(user.id, id));
  const record: OfflineSnapshotRecord = {
    key: buildScopedKey(user.id, id),
    id,
    userId: user.id,
    entity,
    entityId,
    revision: input.revision ?? null,
    baseRevision: input.baseRevision ?? existing?.revision ?? null,
    payload: extracted.payload,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await offlineDb.transaction('rw', offlineDb.snapshots, offlineDb.blobs, async () => {
    await deleteOwnerBlobs(user.id, 'snapshot', id, collectOfflineBlobIds(extracted.payload));
    if (extracted.blobs.length) await offlineDb.blobs.bulkPut(extracted.blobs);
    await offlineDb.snapshots.put(record);
  });
  return record;
}

export async function getOfflineSnapshot<T = unknown>(
  entity: string,
  entityId: string | number,
  options: { userId?: string; rehydrate?: OfflineRehydrateMode } = {},
): Promise<(Omit<OfflineSnapshotRecord<T>, 'payload'> & { payload: T }) | null> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const id = `${String(entity).trim()}:${String(entityId).trim()}`;
  const record = await offlineDb.snapshots.get(buildScopedKey(user.id, id));
  if (!record) return null;
  const blobs = await loadBlobMap(user.id, record.payload);
  return { ...record, payload: await rehydrateOfflineBlobs(record.payload, blobs, options.rehydrate) as T };
}

export async function listOfflineSnapshots<T = unknown>(
  entity: string,
  options: { userId?: string; rehydrate?: OfflineRehydrateMode } = {},
): Promise<Array<Omit<OfflineSnapshotRecord<T>, 'payload'> & { payload: T }>> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const records = await offlineDb.snapshots.where('[userId+entity]').equals([user.id, String(entity)]).sortBy('updatedAt');
  return Promise.all(records.reverse().map(async (record) => {
    const blobs = await loadBlobMap(user.id, record.payload);
    return { ...record, payload: await rehydrateOfflineBlobs(record.payload, blobs, options.rehydrate) as T };
  }));
}

export async function setOfflineMeta<T>(name: string, value: T, options: { userId?: string } = {}): Promise<void> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  await offlineDb.meta.put({
    key: buildScopedKey(user.id, String(name)),
    userId: user.id,
    name: String(name),
    value,
    updatedAt: Date.now(),
  });
}

export async function getOfflineMeta<T>(name: string, options: { userId?: string } = {}): Promise<T | null> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const record = await offlineDb.meta.get(buildScopedKey(user.id, String(name)));
  return (record?.value as T) ?? null;
}

export async function putOfflineBlob(input: {
  id?: string;
  blob: Blob;
  ownerId?: string;
  name?: string;
}, options: { userId?: string } = {}): Promise<OfflineBlobRecord> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  if (!(input.blob instanceof Blob)) throw new Error('putOfflineBlob requiere una instancia Blob.');
  const id = String(input.id || createOfflineUuid());
  const record: OfflineBlobRecord = {
    key: buildScopedKey(user.id, id),
    id,
    userId: user.id,
    ownerType: 'standalone',
    ownerId: String(input.ownerId || `blob:${id}`),
    blob: input.blob,
    name: input.name,
    type: input.blob.type || 'application/octet-stream',
    size: input.blob.size,
    createdAt: Date.now(),
  };
  await offlineDb.blobs.put(record);
  return record;
}

export async function getOfflineBlob(id: string, options: { userId?: string } = {}): Promise<OfflineBlobRecord | null> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  return (await offlineDb.blobs.get(buildScopedKey(user.id, String(id)))) || null;
}

export async function removeOfflineBlob(id: string, options: { userId?: string } = {}): Promise<boolean> {
  const user = options.userId ? { id: options.userId } : await requireOfflineUser();
  const key = buildScopedKey(user.id, String(id));
  const exists = await offlineDb.blobs.get(key);
  if (!exists) return false;
  await offlineDb.blobs.delete(key);
  return true;
}

export async function initializeOfflineStorage(user: OfflineUserContext): Promise<void> {
  await adoptLegacyTechnicianData(user.id, user.technicianId);
}

export async function purgeOfflineUser(userId: string): Promise<void> {
  const id = String(userId || '').trim();
  if (!id) return;
  await offlineDb.transaction(
    'rw',
    offlineDb.packages,
    offlineDb.snapshots,
    offlineDb.outbox,
    offlineDb.blobs,
    offlineDb.meta,
    async () => {
      await Promise.all([
        offlineDb.packages.where('userId').equals(id).delete(),
        offlineDb.snapshots.where('userId').equals(id).delete(),
        offlineDb.outbox.where('userId').equals(id).delete(),
        offlineDb.blobs.where('userId').equals(id).delete(),
        offlineDb.meta.where('userId').equals(id).delete(),
      ]);
    },
  );
  clearActiveOfflineUser(id);
}

export async function purgeCurrentOfflineUser(): Promise<void> {
  const current = getActiveOfflineUser();
  if (current) await purgeOfflineUser(current.id);
  else clearActiveOfflineUser();
}
