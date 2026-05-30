import crypto from 'crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let cachedClient = null;

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT
    || process.env.CLOUDFLARE_S3_URL
    || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  return {
    accountId,
    endpoint,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    region: process.env.R2_REGION || 'auto',
  };
}

function assertR2Config(config) {
  const missing = [];
  if (!config.endpoint) missing.push('R2_ACCOUNT_ID, R2_ENDPOINT o CLOUDFLARE_S3_URL');
  if (!config.accessKeyId) missing.push('R2_ACCESS_KEY_ID o CLOUDFLARE_R2_ACCESS_KEY_ID');
  if (!config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY o CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  if (!config.bucket) missing.push('R2_BUCKET o CLOUDFLARE_R2_BUCKET');

  if (missing.length) {
    throw new Error(`Faltan variables R2 en .env.local: ${missing.join(', ')}`);
  }
}

function getClient(config) {
  if (cachedClient) return cachedClient;

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

export function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Adjunto invalido: se esperaba data URL base64.');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export function buildR2Key({ prefix = 'servicios', filename = 'adjunto.bin', extension = '' }) {
  const cleanFilename = String(filename)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'adjunto.bin';
  const suffix = extension && !cleanFilename.endsWith(extension) ? extension : '';
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const random = crypto.randomBytes(8).toString('hex');

  return `${prefix}/${stamp}-${random}-${cleanFilename}${suffix}`;
}

export function buildPrivateR2Url({ bucket, key }) {
  return `r2://${bucket}/${key}`;
}

export function parsePrivateR2Url(value) {
  const match = String(value || '').match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], key: match[2] };
}

async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadBufferToR2({ buffer, key, contentType }) {
  const config = getR2Config();
  assertR2Config(config);

  const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const client = getClient(config);

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: {
      sha256: checksumSha256,
    },
  }));

  return {
    bucket: config.bucket,
    key,
    checksumSha256,
    privateUrl: buildPrivateR2Url({ bucket: config.bucket, key }),
    publicUrl: null,
  };
}

export async function getObjectFromR2({ key }) {
  const config = getR2Config();
  assertR2Config(config);

  const result = await getClient(config).send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));

  return {
    buffer: await bodyToBuffer(result.Body),
    contentType: result.ContentType || 'application/octet-stream',
    contentLength: result.ContentLength,
    etag: result.ETag,
  };
}
