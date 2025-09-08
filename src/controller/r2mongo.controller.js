// src/controller/r2mongo.controller.js
require('dotenv').config();
const multer = require('multer');
const { randomUUID } = require('crypto');
const { s3 } = require('../config/s3');
const { getUrlFor } = require('../lib/r2-urls');
const { getDb } = require('../config/mongoDB');
const { ObjectId } = require('mongodb');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const uploadLimit = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Base pública para arquivos isPublic=true (ex.: https://cdn.larfelizidade.com.br)
const PUBLIC_CDN_BASE = (process.env.PUBLIC_CDN_BASE || process.env.NEXT_PUBLIC_R2_PUBLIC_BASEURL || '').replace(/\/$/, '');

// ----------------- utils -----------------
function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

function sanitizeName(name = 'file') {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '_');
}

function buildKey({ env, app, resource, folder, userId, originalName }) {
  const uuid = randomUUID();
  return `${env}/${app}/${resource}/${userId}/${folder}/${uuid}_${sanitizeName(originalName)}`;
}

/** bucket público x privado */
function pickBucket(isPublic) {
  const PUB = process.env.BUCKET_PUBLIC_NAME || process.env.BUCKET_NAME;
  const PRIV = process.env.BUCKET_PRIVATE_NAME || process.env.BUCKET_NAME;
  return isPublic ? (PUB || process.env.BUCKET_NAME) : PRIV;
}

function buildPublicUrlFromKey(key) {
  if (!PUBLIC_CDN_BASE) return '';
  return `${PUBLIC_CDN_BASE}/${key}`;
}

// ----------------- controllers -----------------

/** GET /r2_files/:id  (ou ?id=...) → retorna URL (presign se privado; direta se público+CDN) */
async function fileGetUrl(req, res) {
  try {
    const rawId = req.params.id || req.query.id || (req.body && req.body.id);
    const _id = toObjectId(rawId);
    if (!_id) return res.status(400).json({ ok: false, error: 'id inválido' });

    const db = getDb();
    // ⚠️ coleção correta é "arquivosr2"
    const file = await db.collection('arquivosr2').findOne({ _id });
    if (!file) return res.status(404).json({ ok: false, error: 'não encontrado' });

    // público via CDN direta
    if (file.isPublic && PUBLIC_CDN_BASE) {
      return res.json({ ok: true, url: buildPublicUrlFromKey(file.key), isPublic: true });
    }

    // caso contrário, URL presign (tempo curto)
    const url = await getUrlFor(file, { presignTtl: 60 });
    res.json({ ok: true, url, isPublic: !!file.isPublic });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

/** DELETE /r2_files/:id  (ou /r2_delete?id=...) */
async function fileDelete(req, res) {
  try {
    const rawId = req.params.id || req.query.id || (req.body && req.body.id);
    const _id = toObjectId(rawId);
    if (!_id) return res.status(400).json({ ok: false, error: 'id inválido' });

    const db = getDb();
    const col = db.collection('arquivosr2'); // coleção correta
    const file = await col.findOne({ _id });
    if (!file) return res.status(404).json({ ok: false, error: 'não encontrado' });

    // (opcional) checar permissão aqui…

    await s3.send(new DeleteObjectCommand({ Bucket: file.bucket, Key: file.key }));
    await col.deleteOne({ _id });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

const uploadMiddleware = uploadLimit.single('file');

/** POST /r2_upload  (multipart) */
async function uploadHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'campo "file" obrigatório (multipart/form-data)' });

    const requiredFields = ['createdBy', 'originalName', 'collection', 'userId', 'folder', 'resource'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ ok: false, error: `campos obrigatórios faltando: ${missingFields.join(', ')}` });
    }

    const env = process.env.NODE_ENV || 'dev';
    const app = 'larfelizidade';
    const resource = req.body.resource || 'attach';
    const userId = req.body.userId || 'guest';
    const folder = req.body.folder || 'misc';
    const isPublic = String(req.body.isPublic || '').toLowerCase() === 'true';

    const key = buildKey({ env, app, resource, folder, userId, originalName: req.file.originalname });
    const bucket = pickBucket(isPublic);

    const put = await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const db = getDb();
    const arquivosR2 = db.collection('arquivosr2');

    // opcional
    const ownerId = req.body.ownerId ? ObjectId.createFromHexString(req.body.ownerId) : null;

    const doc = {
      bucket,
      key,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      size: req.file.size,
      etag: put.ETag,
      isPublic,
      title: req.body.title || null,

      collection: req.body.collection || null, // p.ex. "fotos"
      folder,                                   // p.ex. idosoId
      userId,
      createdBy: req.body.createdBy || null,
      tags: req.body.tags ? [].concat(req.body.tags) : [],
      createdAt: new Date(),
    };

    const { insertedId } = await arquivosR2.insertOne(doc);

    // preferir URL pública quando disponível
    let url = '';
    if (isPublic && PUBLIC_CDN_BASE) url = buildPublicUrlFromKey(doc.key);
    else url = await getUrlFor({ _id: insertedId, ...doc }, { presignTtl: 60 });

    return res.json({ ok: true, file: { id: insertedId, key: doc.key, isPublic: doc.isPublic, url } });
  } catch (e) {
    console.error('upload error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/** GET /fotos?type=latest&limit=10  |  /fotos?type=byResident&idosoId=...&limit=20 */
async function listFotos(req, res) {
  try {
    const { type = 'latest', limit = 10, idosoId } = req.query;
    const db = getDb();
    const col = db.collection('arquivosr2');

    const q = { collection: 'fotos' };
    if (String(type) === 'byResident') {
      if (!idosoId) return res.status(400).json({ ok: false, error: 'idosoId é obrigatório' });
      q.folder = String(idosoId);
    }

    const lim = Math.min(parseInt(limit, 10) || 10, 100);
    const docs = await col.find(q).sort({ createdAt: -1 }).limit(lim).toArray();

    const fotos = await Promise.all(
      docs.map(async (d) => {
        let url = '';
        if (d.isPublic && PUBLIC_CDN_BASE) {
          url = buildPublicUrlFromKey(d.key);
        } else {
          // fallback: URL presign de 60s
          try {
            url = await getUrlFor(d, { presignTtl: 60 });
          } catch { url = ''; }
        }
        return {
          _id: String(d._id),
          idosoId: String(d.folder || ''),
          url,
          createdAt: new Date(d.createdAt || Date.now()).toISOString(),
        };
      })
    );

    return res.json({ ok: true, fotos });
  } catch (e) {
    console.error('GET /fotos error', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

module.exports = {
  uploadMiddleware,
  uploadHandler,
  fileGetUrl,
  fileDelete,
  listFotos, // 👈 novo
};
