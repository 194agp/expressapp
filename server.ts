import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { Application } from 'express';
import cronJobs from './src/cronJobs';
import initRoutes from './src/routes';
import { connect } from './src/config/mongoDB';

async function bootstrap(): Promise<void> {
  const db = await connect();

  const app: Application = express();

  const WHITELIST = [
    'https://www.larfelizidade.com.br',
    'https://larfelizidade.com.br',
    'http://localhost:3000',
  ];

  const corsOptions: cors.CorsOptionsDelegate = (req, cb) => {
    const origin = req.headers.origin;
    const isAllowed = !!origin && WHITELIST.includes(origin);
    cb(null, {
      origin: isAllowed ? origin : false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
    });
  };

  app.use((req, res, next) => { res.setHeader('Vary', 'Origin'); next(); });
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.locals['db'] = db;

  initRoutes(app);

  if (process.env.ENABLE_PORTAO_MQTT === 'true') {
    require('./src/services/mqtt');
  }

  try {
    cronJobs(app);
  } catch (err) {
    console.error('❌ Erro ao configurar cronJobs:', err);
  }

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`🚀 Server rodando em http://localhost:${port}`);
  });
}

bootstrap().catch(err => {
  console.error('❌ Erro ao iniciar a aplicação:', err);
  process.exit(1);
});
