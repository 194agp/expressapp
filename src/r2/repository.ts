// src/r2/repository.ts
// Operações no MongoDB para metadados de arquivos do R2.
// Só toca no banco — sem lógica de negócio, sem HTTP.

import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongoDB';
import { toObjectId } from './utils';

const COLLECTION = 'arquivosr2';

// Representa um documento de arquivo salvo no MongoDB
export interface FileDoc {
  _id: ObjectId;
  bucket: string;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  etag?: string;
  isPublic: boolean;
  title: string | null;
  collection: string | null;
  folder: string;
  userId: string;
  createdBy: string | null;
  ownerId: ObjectId | null;
  tags: string[];
  createdAt: Date;
}

type NewFileDoc = Omit<FileDoc, '_id'>;

function col() {
  return getDb().collection<FileDoc>(COLLECTION);
}

/**
 * Salva metadados de um arquivo recém-feito upload.
 */
export async function saveFile(doc: NewFileDoc): Promise<ObjectId> {
  const { insertedId } = await col().insertOne(doc as FileDoc);
  return insertedId;
}

/**
 * Busca um arquivo pelo ID.
 */
export async function findById(id: unknown): Promise<FileDoc | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  return col().findOne({ _id });
}

/**
 * Remove um arquivo do banco pelo ID.
 */
export async function deleteById(id: unknown): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  const { deletedCount } = await col().deleteOne({ _id });
  return deletedCount > 0;
}

/**
 * Lista arquivos de uma collection, opcionalmente filtrada por folder (ex: idosoId).
 * Ordenado por data de criação decrescente.
 */
export async function listByCollection({ collection, folder, limit = 10 }: {
  collection: string;
  folder?: string;
  limit?: number;
}): Promise<FileDoc[]> {
  const query: Partial<FileDoc> & Record<string, unknown> = { collection };
  if (folder) query.folder = String(folder);
  return col().find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}
