import { Router } from 'express';
import multer from 'multer';
import type { Application } from 'express';
import * as FileController from '../controller/file.controller';
import { convertDocxToPdf } from '../controller/docxToPDF.controller';
import * as PortaoController from '../controller/portao.controller';
import r2Routes from '../r2/routes';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ------------------- GCS (legado) -------------------
router.get('/files', FileController.getListFiles);
router.get('/listBuckets', FileController.listBuckets);
router.get('/files/:name', FileController.download);
router.post('/upload', FileController.upload);
router.post('/criarBucket', FileController.criarBucket);
router.delete('/delete', FileController.deleteFile);

// ------------------- CLOUDFLARE R2 + MONGODB -------------------
// Rotas definidas em src/r2/routes.ts
router.use(r2Routes);

// ------------------- Conversão DOCX → PDF -------------------
router.post('/convert-docx-to-pdf', upload.single('file'), convertDocxToPdf);

// ------------------- PORTÃO ESP8266 -------------------
router.post('/portao/abrir', PortaoController.abrir);   // body: { userId, ms? }
router.get('/portao/logs', PortaoController.logs);      // query: deviceId, limit

export default (app: Application): void => { app.use(router); };
