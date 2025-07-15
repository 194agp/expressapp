// routes.js
const express = require("express");
const router = express.Router();

const FileController = require("../controller/file.controller");
const DocxConverter = require("../controller/docxToPDF.controller");
const scrapeInstagramProfile = require("../scrape/scrape");      // ⚠️ importe aqui
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Listagem de arquivos e buckets
router.get("/files", FileController.getListFiles);
router.get("/listBuckets", FileController.listBuckets);
router.get("/files/:name", FileController.download);

// Upload, criação de bucket e exclusão
router.post("/upload", FileController.upload);
router.post("/criarBucket", FileController.criarBucket);
router.delete("/delete", FileController.deleteFile);

// Conversão DOCX → PDF
router.post("/convert-docx-to-pdf", upload.single("file"), DocxConverter.convertDocxToPdf);

// Rota de scraping do Instagram
router.get("/scrape/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const profileData = await scrapeInstagramProfile(username);
    res.json(profileData);
  } catch (err) {
    console.error("Erro no scraping:", err);
    res
      .status(500)
      .json({ error: "Falha ao raspar Instagram", details: err.message });
  }
});

module.exports = (app) => { app.use(router); };
