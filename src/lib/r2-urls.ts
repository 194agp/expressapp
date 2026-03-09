import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from '../config/s3';

interface FileDoc {
  bucket: string;
  key: string;
  isPublic?: boolean;
}

export function publicUrl({ bucket, accountId, key }: { bucket: string; accountId: string; key: string }): string {
  return `https://${bucket}.${accountId}.r2.dev/${key}`;
}

export async function presignedGetUrl({ bucket, key, expiresIn = 60 }: { bucket: string; key: string; expiresIn?: number }): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function getUrlFor(fileDoc: FileDoc, { presignTtl = 60 } = {}): Promise<string | null> {
  if (!fileDoc) return null;
  const { bucket, key, isPublic } = fileDoc;
  if (isPublic) {
    return publicUrl({ bucket, accountId: process.env.CLDFR_ACCOUNT_ID!, key });
  }
  return presignedGetUrl({ bucket, key, expiresIn: presignTtl });
}
