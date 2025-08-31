// src/controller/s3.controller.js
require('dotenv').config();
const multer = require('multer');
const { s3 } = require('../config/s3');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.BUCKET_NAME;
const ACCOUNT = process.env.CLDFR_ACCOUNT_ID || '';
const PUBLIC_BASE = (BUCKET && ACCOUNT) ? `https://${BUCKET}.${ACCOUNT}.r2.dev` : '';

if (!BUCKET) throw new Error('BUCKET_NAME não definido.');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadFileMiddleware = upload.single('file');

function buildKey(req, file) {
  const userId = req.user?.id ?? 'guest';
  const ts = Date.now();
  const safe = (file.originalname || 'file').replace(/\s+/g, '_');
  return `user_${userId}/${ts}_${safe}`;
}

async function uploadFileHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie o arquivo no campo "file".' });

    const key = buildKey(req, req.file);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'application/octet-stream',
    }));

    const url = PUBLIC_BASE ? `${PUBLIC_BASE}/${key}` : `s3://${BUCKET}/${key}`;
    return res.json({ url, key });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Falha no upload', details: err.message });
  }
}

async function deleteFileHandler(req, res) {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Informe "key" para deletar.' });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return res.json({ message: 'Arquivo deletado.', key });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Falha ao deletar', details: err.message });
  }
}

module.exports = {
  uploadFileMiddleware,
  uploadFileHandler,
  deleteFileHandler,
};
