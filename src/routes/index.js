const express = require("express");
const router = express.Router();
const FileController = require("../controller/file.controller");
const DocxConverter = require("../controller/docxToPDF.controller");
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Configuração para upload em memória

let routes = (app) => {
  router.get("/files", FileController.getListFiles);
  router.get("/listBuckets", FileController.listBuckets);
  router.get("/files/:name", FileController.download);

  router.post("/upload", FileController.upload);
  router.post("/criarBucket", FileController.criarBucket);

  router.delete("/delete", FileController.deleteFile);

   // Rota para conversão DOCX para PDF
   router.post("/convert-docx-to-pdf", upload.single('file'), DocxConverter.convertDocxToPdf);

  app.use(router);
};

module.exports = routes;
