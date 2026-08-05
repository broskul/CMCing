import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { buildScopedKey, extractOfflineBlobs } from './codec';
import type {
  OfflineBlobRecord,
  OfflineMetaRecord,
  OfflineOutboxRecord,
  OfflinePackageRecord,
  OfflineSnapshotRecord,
} from './types';

const DATABASE_NAME = 'cmcing-offline';
export const LEGACY_TECHNICIAN_PREFIX = 'legacy-technician:';

type LegacySyncJob = {
  id: string;
  status?: string;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  payload?: Record<string, unknown>;
};

class CmcOfflineDatabase extends Dexie {
  packages!: EntityTable<OfflinePackageRecord, 'key'>;
  snapshots!: EntityTable<OfflineSnapshotRecord, 'key'>;
  outbox!: EntityTable<OfflineOutboxRecord, 'key'>;
  blobs!: EntityTable<OfflineBlobRecord, 'key'>;
  meta!: EntityTable<OfflineMetaRecord, 'key'>;

  constructor() {
    super(DATABASE_NAME);

    // Version 1 mirrors the native IndexedDB store shipped by the previous facade.
    this.version(1).stores({
      syncJobs: 'id,status,createdAt',
    });

    // Keep syncJobs during this upgrade so its data can be moved atomically.
    this.version(2).stores({
      syncJobs: 'id,status,createdAt',
      packages: '&key,userId,&[userId+id],updatedAt,expiresAt',
      snapshots: '&key,userId,&[userId+entity+entityId],[userId+entity],updatedAt',
      outbox: '&key,id,userId,&[userId+idempotencyKey],[userId+status],[userId+nextAttemptAt],[userId+createdAt],*dependsOn',
      blobs: '&key,id,userId,[userId+ownerId],[userId+createdAt]',
      meta: '&key,userId,&[userId+name],updatedAt',
    }).upgrade(async (transaction) => migrateLegacyJobs(transaction));

    this.version(3).stores({
      syncJobs: null,
      packages: '&key,userId,&[userId+id],updatedAt,expiresAt',
      snapshots: '&key,userId,&[userId+entity+entityId],[userId+entity],updatedAt',
      outbox: '&key,id,userId,&[userId+idempotencyKey],[userId+status],[userId+nextAttemptAt],[userId+createdAt],*dependsOn',
      blobs: '&key,id,userId,[userId+ownerId],[userId+ownerType+ownerId],[userId+createdAt]',
      meta: '&key,userId,&[userId+name],updatedAt',
    });
  }
}

async function migrateLegacyJobs(transaction: Transaction): Promise<void> {
  const legacyTable = transaction.table<LegacySyncJob, string>('syncJobs');
  const jobs = await legacyTable.toArray();
  if (!jobs.length) return;

  for (const job of jobs) {
    const technicianId = job.payload?.tecnicoId;
    const userId = technicianId !== undefined && technicianId !== null
      ? `${LEGACY_TECHNICIAN_PREFIX}${String(technicianId)}`
      : 'legacy-quarantine';
    const id = String(job.id);
    const createdAt = Date.parse(job.createdAt || '') || Date.now();
    const updatedAt = Date.parse(job.updatedAt || '') || createdAt;
    const extracted = await extractOfflineBlobs(job.payload || {}, {
      userId,
      ownerType: 'outbox',
      ownerId: id,
    });
    const status = job.status === 'error' ? 'failed' : 'pending';

    await transaction.table('outbox').put({
      key: buildScopedKey(userId, id),
      id,
      userId,
      idempotencyKey: String(job.payload?.clientMutationId || id),
      operation: 'legacy.technician-sync',
      entity: 'visita',
      payload: extracted.payload,
      dependsOn: [],
      status,
      attempts: Number(job.attempts || 0),
      nextAttemptAt: Date.now(),
      lastError: job.error || '',
      createdAt,
      updatedAt,
    });
    if (extracted.blobs.length) await transaction.table('blobs').bulkPut(extracted.blobs);
  }

  await legacyTable.clear();
}

export const offlineDb = new CmcOfflineDatabase();

export async function adoptLegacyTechnicianData(userId: string, technicianId?: string | number | null): Promise<void> {
  if (technicianId === undefined || technicianId === null || technicianId === '') return;
  const legacyUserId = `${LEGACY_TECHNICIAN_PREFIX}${String(technicianId)}`;
  if (legacyUserId === userId) return;

  await offlineDb.transaction('rw', offlineDb.outbox, offlineDb.blobs, async () => {
    const jobs = await offlineDb.outbox.where('userId').equals(legacyUserId).toArray();
    for (const job of jobs) {
      const existing = await offlineDb.outbox
        .where('[userId+idempotencyKey]')
        .equals([userId, job.idempotencyKey])
        .first();
      await offlineDb.outbox.delete(job.key);
      if (!existing) {
        await offlineDb.outbox.put({
          ...job,
          key: buildScopedKey(userId, job.id),
          userId,
          updatedAt: Date.now(),
        });
      }
    }

    const blobs = await offlineDb.blobs.where('userId').equals(legacyUserId).toArray();
    for (const record of blobs) {
      await offlineDb.blobs.delete(record.key);
      await offlineDb.blobs.put({
        ...record,
        key: buildScopedKey(userId, record.id),
        userId,
      });
    }
  });
}
