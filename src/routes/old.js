// routes.js
const express = require("express");
const router = express.Router();

const FileController = require("../controller/file.controller");
const DocxConverter = require("../controller/docxToPDF.controller");
const R2MongoController = require("../controller/r2mongo.controller");
const multer = require("multer");

// HABILITE o controller do R2:
const { uploadFileMiddleware, uploadFileHandler, deleteFileHandler } = require("../controller/s3.controller");

const upload = multer({ storage: multer.memoryStorage() });
const PortaoController = require("../controller/portao.controller");

// Listagem de arquivos e buckets
router.get("/files", FileController.getListFiles);
router.get("/listBuckets", FileController.listBuckets);
router.get("/files/:name", FileController.download);

// Upload, criação de bucket e exclusão (provavelmente para S3 "padrão")
// (Se estiver migrando 100% para R2, pode desabilitar essas seções)
router.post("/upload", FileController.upload);
router.post("/criarBucket", FileController.criarBucket);
router.delete("/delete", FileController.deleteFile);

// CLOUDFARE R2
// router.post("/r2_upload", uploadFileMiddleware, uploadFileHandler);
// router.delete("/r2_delete", deleteFileHandler);

// CLOUDFLARE R2 && MONGODB
router.get("/r2_files/:id", R2MongoController.fileGetUrl);
router.delete("/r2_files/:id", R2MongoController.fileDelete);
router.post("/r2_upload", R2MongoController.uploadMiddleware, R2MongoController.uploadHandler);
router.delete("/r2_delete", R2MongoController.fileDelete);

// Conversão DOCX → PDF
router.post("/convert-docx-to-pdf", upload.single("file"), DocxConverter.convertDocxToPdf);

// PORTÃO ESP8266 RELE LAR
router.post("/portao/abrir", PortaoController.abrir);   // body: { ms?: number }
router.get("/portao/logs", PortaoController.logs);      // query: deviceId, limit

module.exports = (app) => { app.use(router); };
