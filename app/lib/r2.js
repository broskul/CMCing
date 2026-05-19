import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let client;

function getR2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Faltan variables de Cloudflare R2.');
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    publicUrl: publicUrl?.replace(/\/$/, '') || '',
  };
}

function getR2Client() {
  const config = getR2Config();
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

function getPublicObjectUrl(key) {
  const { publicUrl } = getR2Config();
  return publicUrl ? `${publicUrl}/${key}` : '';
}

async function putR2Object({ key, body, contentType }) {
  const config = getR2Config();
  await getR2Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return {
    bucket: config.bucket,
    objectKey: key,
    url: getPublicObjectUrl(key),
  };
}

async function getR2Object(key) {
  const config = getR2Config();
  return getR2Client().send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}

export { getR2Object, getR2Config, putR2Object };
