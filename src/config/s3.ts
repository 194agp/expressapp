import { S3Client } from '@aws-sdk/client-s3';

const endpoint =
  process.env.ENDPOINT_URL ||
  (process.env.CLDFR_ACCOUNT_ID
    ? `https://${process.env.CLDFR_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '');

if (!endpoint) {
  throw new Error('ENDPOINT_URL não definido e CLDFR_ACCOUNT_ID ausente.');
}

export const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});
