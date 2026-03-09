import multer from 'multer';
import type { Request, Response } from 'express';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../config/s3';

const BUCKET = process.env.BUCKET_NAME!;
const ACCOUNT = process.env.CLDFR_ACCOUNT_ID || '';
const PUBLIC_BASE = (BUCKET && ACCOUNT) ? `https://${BUCKET}.${ACCOUNT}.r2.dev` : '';

if (!BUCKET) throw new Error('BUCKET_NAME não definido.');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadFileMiddleware = upload.single('file');

function buildKey(req: Request, file: Express.Multer.File): string {
  const ts = Date.now();
  const safe = (file.originalname || 'file').replace(/\s+/g, '_');
  return `${ts}_${safe}`;
}

export async function uploadFileHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Envie o arquivo no campo "file".' });
      return;
    }

    const key = buildKey(req, req.file);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'application/octet-stream',
    }));

    const url = PUBLIC_BASE ? `${PUBLIC_BASE}/${key}` : `s3://${BUCKET}/${key}`;
    res.json({ url, key });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Falha no upload', details: err.message });
  }
}

export async function deleteFileHandler(req: Request, res: Response): Promise<void> {
  const { key } = req.body || {};
  if (!key) {
    res.status(400).json({ error: 'Informe "key" para deletar.' });
    return;
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ message: 'Arquivo deletado.', key });
  } catch (err: any) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Falha ao deletar', details: err.message });
  }
}
