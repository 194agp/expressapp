// src/r2/routes.ts
// Rotas do módulo R2.
//
// Endpoints:
//   POST   /r2_upload              → upload de arquivo (multipart/form-data)
//   GET    /r2_files/:id           → URL de acesso (presign ou CDN direta)
//   DELETE /r2_files/:id           → remove do R2 + MongoDB
//   DELETE /r2_delete?id=<id>      → alias do delete (compatibilidade)
//   GET    /fotos                  → lista fotos com URL resolvida
//                                    ?type=latest&limit=10
//                                    ?type=byResident&idosoId=<ID>&limit=20

import { Router } from 'express';
import { uploadMiddleware, handleUpload, handleGetUrl, handleDelete, handleListFotos } from './controller';

const router = Router();

router.post('/r2_upload', uploadMiddleware, handleUpload);
router.get('/r2_files/:id', handleGetUrl);
router.delete('/r2_files/:id', handleDelete);
router.delete('/r2_delete', handleDelete);
router.get('/fotos', handleListFotos);

export default router;
