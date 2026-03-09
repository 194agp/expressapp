// src/r2/service.ts
// Lógica de negócio do R2: orquestra storage (R2) + repository (MongoDB).
// É aqui que as regras ficam — controllers só chamam funções daqui.

import { ObjectId } from 'mongodb';
import { putObject, deleteObject, presignedGetUrl } from './storage';
import { saveFile, findById, deleteById, listByCollection, type FileDoc } from './repository';
import { buildKey, pickBucket, buildPublicUrl, PUBLIC_CDN_BASE, toObjectId, type FileOwner } from './utils';

// ─────────────────────────────────────────
// Resolução de URL
// ─────────────────────────────────────────

interface UrlResult {
  url: string;
  isPublic: boolean;
  file: FileDoc;
}

/**
 * Retorna a URL de acesso a um arquivo, seja via CDN (público) ou presigned (privado).
 */
export async function getFileUrl(id: unknown, { presignTtl = 60 } = {}): Promise<UrlResult | null> {
  const file = await findById(id);
  if (!file) return null;

  if (file.isPublic && PUBLIC_CDN_BASE) {
    return { url: buildPublicUrl(file.key), isPublic: true, file };
  }

  const url = await presignedGetUrl({ bucket: file.bucket, key: file.key, expiresIn: presignTtl });
  return { url, isPublic: false, file };
}

// ─────────────────────────────────────────
// Upload
// ─────────────────────────────────────────

interface UploadParams {
  fileBuffer: Buffer;
  mimetype: string;
  originalName: string;
  body: Record<string, string>;
}

interface UploadResult {
  id: ObjectId;
  key: string;
  isPublic: boolean;
  url: string;
}

/**
 * Faz upload de um arquivo para o R2 e salva os metadados no MongoDB.
 */
export async function uploadFile({ fileBuffer, mimetype, originalName, body }: UploadParams): Promise<UploadResult> {
  const env = process.env.NODE_ENV || 'dev';

  const {
    resource = 'attach',
    userId,
    ownerType = 'usuario',  // 'usuario' | 'empresa'
    collection = null,
    createdBy = null,
    title = null,
    tags,
    ownerId,
  } = body as any;

  const isPublic = String(body.isPublic || '').toLowerCase() === 'true';

  // Monta o owner para o buildKey
  const owner: FileOwner = ownerType === 'empresa'
    ? { type: 'empresa' }
    : { type: 'usuario', userId: userId || 'guest' };

  const key = buildKey({ env, owner, resource, originalName });
  const bucket = pickBucket(isPublic);

  const putResult = await putObject({ bucket, key, buffer: fileBuffer, contentType: mimetype });

  const doc = {
    bucket,
    key,
    originalName,
    contentType: mimetype,
    size: fileBuffer.length,
    etag: putResult.ETag,
    isPublic,
    title,
    collection,
    folder: owner.type === 'usuario' ? owner.userId : 'empresa',
    userId: owner.type === 'usuario' ? owner.userId : 'empresa',
    createdBy,
    ownerId: toObjectId(ownerId) || null,
    tags: tags ? ([] as string[]).concat(tags) : [],
    createdAt: new Date(),
  };

  const insertedId = await saveFile(doc);

  let url = '';
  if (isPublic && PUBLIC_CDN_BASE) {
    url = buildPublicUrl(key);
  } else {
    url = await presignedGetUrl({ bucket, key, expiresIn: 60 });
  }

  return { id: insertedId, key, isPublic, url };
}

// ─────────────────────────────────────────
// Delete
// ─────────────────────────────────────────

/**
 * Remove um arquivo do R2 e do MongoDB.
 */
export async function removeFile(id: unknown): Promise<boolean> {
  const file = await findById(id);
  if (!file) return false;

  await deleteObject({ bucket: file.bucket, key: file.key });
  await deleteById(id);
  return true;
}

// ─────────────────────────────────────────
// Listagem de fotos
// ─────────────────────────────────────────

interface FotoItem {
  _id: string;
  idosoId: string;
  url: string;
  createdAt: string;
}

interface ListFotosParams {
  type?: string;
  limit?: number | string;
  idosoId?: string;
  presignTtl?: number;
}

/**
 * Lista fotos da collection "fotos", com URL resolvida.
 */
export async function listFotos({ type = 'latest', limit = 10, idosoId, presignTtl = 60 }: ListFotosParams = {}): Promise<FotoItem[]> {
  const folder = String(type) === 'byResident' ? idosoId : undefined;
  const lim = Math.min(parseInt(String(limit), 10) || 10, 100);

  const docs = await listByCollection({ collection: 'fotos', folder, limit: lim });

  return Promise.all(docs.map(async (d) => {
    let url = '';
    if (d.isPublic && PUBLIC_CDN_BASE) {
      url = buildPublicUrl(d.key);
    } else {
      try {
        url = await presignedGetUrl({ bucket: d.bucket, key: d.key, expiresIn: presignTtl });
      } catch {
        url = '';
      }
    }
    return {
      _id: String(d._id),
      idosoId: String(d.folder || ''),
      url,
      createdAt: new Date(d.createdAt || Date.now()).toISOString(),
    };
  }));
}
