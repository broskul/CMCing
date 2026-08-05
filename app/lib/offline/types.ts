export type OfflineUserId = string;

export type OfflineOutboxStatus = 'pending' | 'running' | 'failed' | 'blocked';

export type OfflineRehydrateMode = 'original' | 'blob' | 'data-url' | 'reference';

export interface OfflineUserContext {
  /** Composite storage partition. Use userId when there is no tenant boundary. */
  id: OfflineUserId;
  userId?: string;
  tenantId?: string;
  technicianId?: string;
  email?: string;
  verifiedAt?: number;
}

export interface OfflineBlobReference {
  __cmcingOfflineBlob: true;
  id: string;
  name?: string;
  type: string;
  size: number;
  source: 'blob' | 'file' | 'data-url';
}

export interface OfflineBlobRecord {
  key: string;
  id: string;
  userId: OfflineUserId;
  ownerType: 'package' | 'snapshot' | 'outbox' | 'standalone';
  ownerId: string;
  blob: Blob;
  name?: string;
  type: string;
  size: number;
  createdAt: number;
}

export interface OfflinePackageRecord<T = unknown> {
  key: string;
  id: string;
  userId: OfflineUserId;
  revision?: string | number | null;
  payload: T;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number | null;
}

export interface OfflineSnapshotRecord<T = unknown> {
  key: string;
  id: string;
  userId: OfflineUserId;
  entity: string;
  entityId: string;
  revision?: string | number | null;
  baseRevision?: string | number | null;
  payload: T;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineOutboxRecord<T = unknown> {
  key: string;
  id: string;
  userId: OfflineUserId;
  idempotencyKey: string;
  operation: string;
  entity?: string;
  entityId?: string;
  payload: T;
  dependsOn: string[];
  baseRevision?: string | number | null;
  status: OfflineOutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  leaseUntil?: number | null;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineMetaRecord<T = unknown> {
  key: string;
  userId: OfflineUserId;
  name: string;
  value: T;
  updatedAt: number;
}

export interface EnqueueOutboxInput<T = unknown> {
  id?: string;
  clientMutationId?: string;
  idempotencyKey?: string;
  operation: string;
  entity?: string;
  entityId?: string | number;
  payload: T;
  dependsOn?: string[];
  baseRevision?: string | number | null;
}

export interface OfflineSyncHandlerResult {
  ok?: boolean;
  retryable?: boolean;
  retryAfterMs?: number;
  error?: string;
  result?: unknown;
}

export type OfflineSyncHandler = (
  entry: OfflineOutboxRecord,
  context: { signal?: AbortSignal },
) => Promise<OfflineSyncHandlerResult | void>;
