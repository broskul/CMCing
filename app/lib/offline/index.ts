'use client';

export type * from './types';
export { createOfflineUuid } from './codec';
export {
  clearActiveOfflineUser,
  getActiveOfflineUser,
  OFFLINE_USER_CHANGED_EVENT,
  refreshOfflineUserFromSession,
  requireOfflineUser,
  setActiveOfflineUser,
  configureOfflinePartition,
} from './user';
export {
  getOfflineMeta,
  getOfflineBlob,
  getOfflinePackage,
  getOfflineSnapshot,
  initializeOfflineStorage,
  listOfflineSnapshots,
  purgeCurrentOfflineUser,
  purgeOfflineUser,
  putOfflinePackage,
  putOfflineBlob,
  putOfflineSnapshot,
  removeOfflinePackage,
  removeOfflineBlob,
  setOfflineMeta,
} from './storage';
export {
  completeOutboxEntry,
  computeOfflineRetryDelay,
  discardOutboxEntry,
  enqueueOutbox,
  getOutboxEntry,
  listOutboxEntries,
  syncOutbox,
  updateOutboxEntry,
  withOfflineSyncLock,
} from './outbox';

// Domain-oriented aliases for the technician application. The lower-level names
// remain exported for callers that need the complete records.
export { putOfflinePackage as saveWorkPackage, getOfflinePackage as getWorkPackage } from './storage';
export { putOfflineSnapshot as upsertOfflineSnapshot } from './storage';
export {
  enqueueOutbox as enqueueOfflineMutation,
  listOutboxEntries as listOfflineMutations,
  updateOutboxEntry as updateOfflineMutation,
  syncOutbox as runOfflineSyncCoordinator,
} from './outbox';
export { purgeCurrentOfflineUser as purgeCurrentUserOfflineData } from './storage';
