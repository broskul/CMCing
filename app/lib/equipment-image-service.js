import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';
import {
  buildDeterministicR2Key,
  deleteObjectFromR2,
  detectImageMimeType,
  sha256Buffer,
  uploadBufferToR2,
} from './r2';
import { getSupabaseAdmin } from './supabase-server';
import { equipmentId } from './equipment-service';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function domainError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number);
    return first === 10
      || first === 127
      || first === 0
      || first >= 224
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized.startsWith('fe80:')
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('::ffff:127.')
      || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.');
  }
  return true;
}

async function assertSafeRemoteUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw domainError('La URL de imagen no es válida.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || (url.port && !['80', '443'].includes(url.port))) {
    throw domainError('La URL debe usar HTTP o HTTPS estándar.');
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw domainError('La URL de imagen no puede apuntar a una red interna.');
  }
  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw domainError('La URL de imagen no puede apuntar a una red interna.');
  }
  return url;
}

async function responseToLimitedBuffer(response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw domainError('La imagen supera el máximo de 12 MB.');
  if (!response.body) throw domainError('No se pudo descargar la imagen.');

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw domainError('La imagen supera el máximo de 12 MB.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function downloadRemoteImage(rawUrl) {
  let url = await assertSafeRemoteUrl(rawUrl);
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || attempt === MAX_REDIRECTS) throw domainError('La URL de imagen redirige demasiadas veces.');
      url = await assertSafeRemoteUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw domainError('No se pudo descargar la imagen indicada.');
    return {
      buffer: await responseToLimitedBuffer(response),
      filename: url.pathname.split('/').pop() || 'imagen-equipo',
    };
  }
  throw domainError('No se pudo descargar la imagen indicada.');
}

async function imageFromFormData(formData) {
  const file = formData.get('imageFile');
  const imageUrl = String(formData.get('imageUrl') || '').trim();
  if (file && imageUrl) throw domainError('Use un archivo o una URL de imagen, no ambos.');
  if (file && typeof file.arrayBuffer === 'function') {
    if (Number(file.size || 0) > MAX_IMAGE_BYTES) throw domainError('La imagen supera el máximo de 12 MB.');
    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'imagen-equipo',
    };
  }
  if (imageUrl) return downloadRemoteImage(imageUrl);
  return null;
}

export async function replaceEquipmentImage(id, formData) {
  const equipmentIdValue = equipmentId(id);
  const source = await imageFromFormData(formData);
  if (!source) throw domainError('Seleccione o pegue una imagen para cargar.');
  const mimeType = detectImageMimeType(source.buffer);
  if (!mimeType) throw domainError('El contenido no corresponde a una imagen JPEG, PNG, WebP o GIF válida.', 415);

  const db = getSupabaseAdmin();
  const existingResult = await db
    .from('Equipo')
    .select('id,imagenR2Key')
    .eq('id', equipmentIdValue)
    .maybeSingle();
  if (existingResult.error) throw domainError(`No se pudo leer el equipo: ${existingResult.error.message}`, 500);
  if (!existingResult.data) throw domainError('Equipo no encontrado.', 404);

  const checksumSha256 = sha256Buffer(source.buffer);
  const upload = await uploadBufferToR2({
    buffer: source.buffer,
    key: buildDeterministicR2Key({
      prefix: `private/equipos/${equipmentIdValue}`,
      clientActionId: crypto.randomUUID(),
      checksumSha256,
      filename: source.filename,
    }),
    contentType: mimeType,
  });

  const updateResult = await db
    .from('Equipo')
    .update({
      imagenUrl: null,
      imagenR2Bucket: upload.bucket,
      imagenR2Key: upload.key,
      imagenMimeType: mimeType,
      imagenSizeBytes: source.buffer.length,
      imagenChecksumSha256: upload.checksumSha256,
    })
    .eq('id', equipmentIdValue)
    .select('*')
    .single();
  if (updateResult.error) {
    await deleteObjectFromR2({ key: upload.key }).catch(() => null);
    throw domainError(`No se pudo registrar la imagen del equipo: ${updateResult.error.message}`, 500);
  }

  const previousKey = existingResult.data.imagenR2Key;
  if (previousKey && previousKey !== upload.key) {
    await deleteObjectFromR2({ key: previousKey }).catch(() => null);
  }
  return updateResult.data;
}
