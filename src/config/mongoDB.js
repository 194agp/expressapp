// src/config/db.js
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;       // ex: "mongodb+srv://user:pass@cluster0.xyz.mongodb.net"
const dbName = process.env.MONGODB_DBNAME; // ex: "meuBanco"

let client;
let db;

/**
 * Conecta (ou retorna conexão já existente)
 * @returns {Promise<import('mongodb').Db>}
 */
async function connect() {
  if (db) return db;

  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // poolSize, serverSelectionTimeoutMS etc, se precisar customizar…
  });

  await client.connect();
  db = client.db(dbName);
  console.log(`✔️ Conectado ao MongoDB: ${dbName}`);
  return db;
}

/**
 * Retorna instância do DB (depois de connect())
 */
function getDb() {
  if (!db) throw new Error('MongoDB não inicializado. Chame connect() antes.');
  return db;
}

module.exports = { connect, getDb };
