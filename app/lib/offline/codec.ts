import type {
  OfflineBlobRecord,
  OfflineBlobReference,
  OfflineRehydrateMode,
  OfflineUserId,
} from './types';

const DATA_URL_PATTERN = /^data:([^;,]*)(?:;charset=[^;,]*)?(;base64)?,([\s\S]*)$/i;

export function createOfflineUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('El navegador no ofrece un generador criptografico para UUID offline.');
  }

  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function buildScopedKey(userId: OfflineUserId, id: string): string {
  return `${encodeURIComponent(userId)}::${id}`;
}

export function isOfflineBlobReference(value: unknown): value is OfflineBlobReference {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as OfflineBlobReference).__cmcingOfflineBlob === true
    && typeof (value as OfflineBlobReference).id === 'string',
  );
}

function dataUrlToBlob(value: string): Blob | null {
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) return null;

  try {
    const mimeType = match[1] || 'application/octet-stream';
    const encoded = match[3] || '';
    const binary = match[2]
      ? globalThis.atob(encoded.replace(/\s/g, ''))
      : decodeURIComponent(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo rehidratar el archivo offline.'));
    reader.readAsDataURL(blob);
  });
}

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

export async function extractOfflineBlobs(
  value: unknown,
  context: {
    userId: OfflineUserId;
    ownerType: OfflineBlobRecord['ownerType'];
    ownerId: string;
  },
): Promise<{ payload: unknown; blobs: OfflineBlobRecord[] }> {
  const blobs: OfflineBlobRecord[] = [];
  const visited = new WeakSet<object>();

  const storeBlob = (blob: Blob, source: OfflineBlobReference['source'], name?: string): OfflineBlobReference => {
    const id = createOfflineUuid();
    blobs.push({
      key: buildScopedKey(context.userId, id),
      id,
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
      blob,
      name,
      type: blob.type || 'application/octet-stream',
      size: blob.size,
      createdAt: Date.now(),
    });
    return {
      __cmcingOfflineBlob: true,
      id,
      name,
      type: blob.type || 'application/octet-stream',
      size: blob.size,
      source,
    };
  };

  const visit = async (current: unknown): Promise<unknown> => {
    if (isOfflineBlobReference(current)) return current;
    if (isFile(current)) return storeBlob(current, 'file', current.name);
    if (isBlob(current)) return storeBlob(current, 'blob');
    if (typeof current === 'string') {
      const blob = dataUrlToBlob(current);
      return blob ? storeBlob(blob, 'data-url') : current;
    }
    if (!current || typeof current !== 'object') return current;
    if (current instanceof Date) return current;
    if (visited.has(current)) throw new Error('El payload offline no puede contener referencias circulares.');

    visited.add(current);
    if (Array.isArray(current)) {
      const items = await Promise.all(current.map(visit));
      visited.delete(current);
      return items;
    }

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(current)) result[key] = await visit(nested);
    visited.delete(current);
    return result;
  };

  return { payload: await visit(value), blobs };
}

export async function rehydrateOfflineBlobs(
  value: unknown,
  records: Map<string, OfflineBlobRecord>,
  mode: OfflineRehydrateMode = 'original',
): Promise<unknown> {
  const visit = async (current: unknown): Promise<unknown> => {
    if (isOfflineBlobReference(current)) {
      if (mode === 'reference') return current;
      const record = records.get(current.id);
      if (!record) throw new Error(`Falta el archivo offline ${current.id}.`);
      if (mode === 'data-url' || (mode === 'original' && current.source === 'data-url')) {
        return blobToDataUrl(record.blob);
      }
      if (mode === 'original' && current.source === 'file' && typeof File !== 'undefined') {
        return new File([record.blob], current.name || record.name || 'archivo', {
          type: record.type,
          lastModified: record.createdAt,
        });
      }
      return record.blob;
    }
    if (!current || typeof current !== 'object' || current instanceof Date || isBlob(current)) return current;
    if (Array.isArray(current)) return Promise.all(current.map(visit));

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(current)) result[key] = await visit(nested);
    return result;
  };

  return visit(value);
}

export function collectOfflineBlobIds(value: unknown): string[] {
  const ids = new Set<string>();
  const visit = (current: unknown) => {
    if (isOfflineBlobReference(current)) {
      ids.add(current.id);
      return;
    }
    if (!current || typeof current !== 'object' || current instanceof Date || isBlob(current)) return;
    if (Array.isArray(current)) current.forEach(visit);
    else Object.values(current).forEach(visit);
  };
  visit(value);
  return Array.from(ids);
}
