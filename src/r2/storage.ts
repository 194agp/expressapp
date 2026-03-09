// src/r2/storage.ts
// Operações de baixo nível com o Cloudflare R2 (via SDK S3).
// Nada de lógica de negócio aqui — só chamadas ao bucket.

import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from './client';

interface PutObjectParams {
  bucket: string;
  key: string;
  buffer: Buffer;
  contentType?: string;
}

interface StorageKeyParams {
  bucket: string;
  key: string;
}

interface PresignParams extends StorageKeyParams {
  expiresIn?: number;
}

/**
 * Faz upload de um buffer para o R2.
 */
export async function putObject({ bucket, key, buffer, contentType }: PutObjectParams): Promise<PutObjectCommandOutput> {
  return s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

/**
 * Remove um objeto do R2.
 */
export async function deleteObject({ bucket, key }: StorageKeyParams): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Gera uma URL presignada de leitura (expiresIn em segundos, padrão 60s).
 */
export async function presignedGetUrl({ bucket, key, expiresIn = 60 }: PresignParams): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

/**
 * Monta a URL pública r2.dev para arquivos públicos sem CDN.
 * Prefira buildPublicUrl() de utils.ts se tiver CDN configurado.
 */
export function buildR2DevUrl({ bucket, key }: StorageKeyParams): string {
  const accountId = process.env.CLDFR_ACCOUNT_ID;
  return `https://${bucket}.${accountId}.r2.dev/${key}`;
}
