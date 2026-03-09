// src/r2/client.ts
// Cliente S3 configurado para Cloudflare R2.
// Singleton: importado por storage.ts — não use diretamente nos controllers.

import { S3Client } from '@aws-sdk/client-s3';

const endpoint =
  process.env.ENDPOINT_URL ||
  (process.env.CLDFR_ACCOUNT_ID
    ? `https://${process.env.CLDFR_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '');

if (!endpoint) {
  throw new Error('[R2] ENDPOINT_URL não definido e CLDFR_ACCOUNT_ID ausente — verifique o .env');
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
