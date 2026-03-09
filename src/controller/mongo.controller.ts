import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongoDB';

export async function getUserName(_id: string | ObjectId): Promise<string> {
  if (!_id) throw new Error('_id obrigatório');

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(_id);
  } catch {
    throw new Error('Formato de _id inválido');
  }

  const db = getDb();
  const usuario = await db.collection<{ _id: ObjectId; nome: string }>('usuario').findOne(
    { _id: objectId },
    { projection: { nome: 1 } }
  );

  if (!usuario) throw new Error('Usuário não encontrado');
  return usuario.nome;
}
