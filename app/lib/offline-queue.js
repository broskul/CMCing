const DB_NAME = 'cmcing-offline';
const DB_VERSION = 1;
const STORE_NAME = 'syncJobs';

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function enqueueSyncJob(payload) {
  const now = new Date().toISOString();
  const job = {
    id: payload.clientMutationId || crypto.randomUUID(),
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    payload,
  };

  await withStore('readwrite', (store) => store.put(job));
  return job;
}

export async function listSyncJobs() {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    request.onerror = () => reject(request.error);
  }));
}

export async function updateSyncJob(id, patch) {
  return withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const current = getRequest.result;
      if (!current) {
        resolve(null);
        return;
      }

      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      const putRequest = store.put(next);
      putRequest.onsuccess = () => resolve(next);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  }));
}

export async function deleteSyncJob(id) {
  return withStore('readwrite', (store) => store.delete(id));
}
