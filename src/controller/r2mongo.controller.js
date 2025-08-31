// src/controller/upload.controller.js
require('dotenv').config();
const multer = require('multer');
const { randomUUID } = require('crypto');
const { s3 } = require('../config/s3');
const { getUrlFor } = require('../lib/r2-urls');
const { getDb } = require('../config/mongoDB');
const { ObjectId } = require('mongodb');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const uploadLimit = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

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

function buildKey({ env, app, recurso, ident, originalName }) {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const uuid = randomUUID();
    return `${env}/${app}/${recurso}/${ident}/${yyyy}/${mm}/${uuid}_${sanitizeName(originalName)}`;
}

/**
 * Escolhe o bucket certo (público x privado).
 * Se quiser só 1 bucket, deixe BUCKET_PRIVATE_NAME vazio que ele cai no BUCKET_NAME.
*/

function pickBucket(isPublic) {
    const PUB = process.env.BUCKET_PUBLIC_NAME || process.env.BUCKET_NAME;
    const PRIV = process.env.BUCKET_PRIVATE_NAME || process.env.BUCKET_NAME;
    return isPublic ? (PUB || process.env.BUCKET_NAME) : PRIV;
}

// *********************************************************************************
// *********************************************************************************
// FUNÇÕES EXPORTADAS
// *********************************************************************************
// *********************************************************************************

async function fileGetUrl(req, res) {
    try {
        const _id = toObjectId(req.params.id);
        if (!_id) return res.status(400).json({ ok: false, error: 'id inválido' });

        const db = getDb();
        const file = await db.collection('files').findOne({ _id });
        if (!file) return res.status(404).json({ ok: false, error: 'não encontrado' });

        // (opcional) checar permissão aqui…
        const url = await getUrlFor(file, { presignTtl: 60 });
        res.json({ ok: true, url, isPublic: file.isPublic });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}

async function fileDelete(req, res) {
    try {
        const _id = toObjectId(req.params.id);
        if (!_id) return res.status(400).json({ ok: false, error: 'id inválido' });

        const db = getDb();
        const file = await db.collection('files').findOne({ _id });
        if (!file) return res.status(404).json({ ok: false, error: 'não encontrado' });

        // (opcional) checar permissão aqui…
        await s3.send(new DeleteObjectCommand({ Bucket: file.bucket, Key: file.key }));
        await db.collection('files').deleteOne({ _id });

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}

const uploadMiddleware = uploadLimit.single('file');

async function uploadHandler(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: 'campo "file" obrigatório (multipart/form-data)' });

        const env = process.env.NODE_ENV || 'dev';
        const app = 'larfelizidade';
        const recurso = req.body.recurso || 'anexos';
        const ident = req.body.ident || 'usuario_guest';
        const isPublic = String(req.body.isPublic || '').toLowerCase() === 'true';

        const key = buildKey({ env, app, recurso, ident, originalName: req.file.originalname });
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

        const ownerId = req.body.ownerId
            ? ObjectId.createFromHexString(req.body.ownerId)
            : null;

        const doc = {
            bucket,
            key,
            originalName: req.file.originalname,
            contentType: req.file.mimetype,
            size: req.file.size,
            etag: put.ETag,
            isPublic,
            dbName: req.body.dbName || null,
            ownerType: req.body.ownerType || null,
            ownerId: ownerId,
            createdBy: req.user?._id || null,
            tags: req.body.tags ? [].concat(req.body.tags) : [],
            createdAt: new Date(),
        };

        const { insertedId } = await arquivosR2.insertOne(doc);
        const url = await getUrlFor(doc, { presignTtl: 60 });

        return res.json({ ok: true, file: { id: insertedId, key: doc.key, isPublic: doc.isPublic, url } });
    } catch (e) {
        console.error('upload error:', e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}

module.exports = { uploadMiddleware, uploadHandler, fileGetUrl, fileDelete };
