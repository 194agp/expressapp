// src/r2/utils.ts
// Funções auxiliares usadas em todo o módulo R2.

import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';

// CDN pública (arquivos isPublic=true). Ex: https://cdn.larfelizidade.com.br
export const PUBLIC_CDN_BASE = (
  process.env.PUBLIC_CDN_BASE ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASEURL ||
  ''
).replace(/\/$/, '');

/**
 * Converte string/ObjectId para ObjectId do MongoDB.
 * Retorna null se inválido — o caller decide o que fazer.
 */
export function toObjectId(id: unknown): ObjectId | null {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

/**
 * Remove acentos e caracteres especiais de um nome de arquivo.
 * Retorna 'file' como fallback se o resultado for vazio.
 */
export function sanitizeName(name = 'file'): string {
  const clean = String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '_');
  return clean || 'file';
}

// Owner do arquivo: usuário específico ou a empresa
export type FileOwner =
  | { type: 'usuario'; userId: string }
  | { type: 'empresa' };

interface BuildKeyParams {
  env: string;
  owner: FileOwner;
  resource: string;   // ex: 'fotos', 'docs', 'contratos'
  originalName: string;
}

/**
 * Monta a chave (path) do objeto dentro do bucket.
 *
 * Usuário:  {env}/usuarios/{userId}/{resource}/{uuid}_{nome}
 * Empresa:  {env}/empresa/{resource}/{uuid}_{nome}
 */
export function buildKey({ env, owner, resource, originalName }: BuildKeyParams): string {
  const uuid = randomUUID();
  const ownerPath = owner.type === 'usuario'
    ? `usuarios/${sanitizeName(owner.userId)}`
    : 'empresa';
  return `${env}/${ownerPath}/${sanitizeName(resource)}/${uuid}_${sanitizeName(originalName)}`;
}

/**
 * Escolhe o bucket certo com base em isPublic.
 */
export function pickBucket(isPublic: boolean): string {
  return isPublic
    ? (process.env.BUCKET_PUBLIC_NAME || process.env.BUCKET_NAME || '')
    : (process.env.BUCKET_PRIVATE_NAME || process.env.BUCKET_NAME || '');
}

/**
 * Monta a URL pública via CDN (só quando PUBLIC_CDN_BASE estiver configurado).
 */
export function buildPublicUrl(key: string): string {
  if (!PUBLIC_CDN_BASE) return '';
  return `${PUBLIC_CDN_BASE}/${key}`;
}
