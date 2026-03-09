import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DBNAME!;

let client: MongoClient;
let db: Db;

/**
 * Conecta (ou retorna conexão já existente).
 */
export async function connect(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log(`✔️ Conectado ao MongoDB: ${dbName}`);
  return db;
}

/**
 * Retorna a instância do DB (depois de connect()).
 */
export function getDb(): Db {
  if (!db) throw new Error('MongoDB não inicializado. Chame connect() antes.');
  return db;
}
