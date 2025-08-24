// server.js
require('dotenv').config();

const cors = require("cors");
const express = require("express");
const cronJobs = require('./src/cronJobs');      // Seus cron jobs, se precisarem de db use app.locals.db
const initRoutes = require("./src/routes");
const { connect } = require("./src/config/mongoDB");    // <-- nosso módulo de conexão

async function bootstrap() {
  // 1) Conecta no MongoDB (vai criar o cliente e o pool pela primeira vez)
  const db = await connect();

  // 2) Sobe o Express
  const app = express();

  // 3) Middlewares
  app.use(cors({ origin: "*" }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 4) Injeta o objeto db para uso nos controllers
  app.locals.db = db;
  // Se preferir, você pode também requerer getDb() diretamente lá onde usar.

  // 5) Rotas
  initRoutes(app);

  // server.js (depois de initRoutes/app prontos)
  if (process.env.ENABLE_PORTAO_MQTT === "true") {
    require("./src/services/mqtt"); // registra subscribe em /stat e grava no Mongo
  }

  // 6) Cron Jobs (se eles fizerem uso de app.locals.db, garanta que rodem depois do connect)
  try {
    cronJobs(app);
  } catch (err) {
    console.error("❌ Erro ao configurar cronJobs:", err);
  }

  // 7) Start server
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`🚀 Server rodando em http://localhost:${port}`);
  });
}

bootstrap().catch(err => {
  console.error("❌ Erro ao iniciar a aplicação:", err);
  process.exit(1);
});
