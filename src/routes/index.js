const express = require("express");
const router = express.Router();
const FileController = require("../controller/file.controller");

let routes = (app) => {
  router.get("/files", FileController.getListFiles);
  router.get("/listBuckets", FileController.listBuckets);
  router.get("/files/:name", FileController.download);

  router.post("/upload", FileController.upload);
  router.post("/criarBucket", FileController.criarBucket);

  router.delete("/delete", FileController.deleteFile);

  app.use(router);
};

module.exports = routes;
