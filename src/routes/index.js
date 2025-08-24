// routes.js
const express = require("express");
const router = express.Router();

const FileController = require("../controller/file.controller");
const DocxConverter = require("../controller/docxToPDF.controller");
const multer = require("multer");
const { uploadFileMiddleware, uploadFileHandler, deleteFileHandler } = require("../controller/s3.controller");
const upload = multer({ storage: multer.memoryStorage() });
const PortaoController = require("../controller/portao.controller");

// Listagem de arquivos e buckets
router.get("/files", FileController.getListFiles);
router.get("/listBuckets", FileController.listBuckets);
router.get("/files/:name", FileController.download);

// Upload, criação de bucket e exclusão
router.post("/upload", FileController.upload);
router.post("/criarBucket", FileController.criarBucket);
router.delete("/delete", FileController.deleteFile);

// CLOUDFARE R2
router.post("/r2_upload", uploadFileMiddleware, uploadFileHandler);
router.delete("/r2_delete", deleteFileHandler);

// Conversão DOCX → PDF
router.post("/convert-docx-to-pdf", upload.single("file"), DocxConverter.convertDocxToPdf);

// PORTÃO ESP8266 RELE LAR
router.post("/portao/abrir", PortaoController.abrir);   // body: { ms?: number }
router.get("/portao/logs", PortaoController.logs);      // query: deviceId, limit

module.exports = (app) => { app.use(router); };
