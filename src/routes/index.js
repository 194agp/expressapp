const express = require("express");
const router = express.Router();
const controller = require("../controller/file.controller");

let routes = (app) => {
  router.get("/files", controller.getListFiles);
  router.get("/files/:name", controller.download);

  router.post("/upload", controller.upload);

  router.delete("/delete", controller.deleteFile);

  app.use(router);
};

module.exports = routes;
