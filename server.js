const cors = require("cors");
const express = require("express");
const cronJobs = require('./src/cronJobs'); // Importa o módulo de cron jobs
const app = express();

let corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));

const initRoutes = require("./src/routes");

app.use(express.urlencoded({ extended: true }));
initRoutes(app);

const port = 8080;
app.listen(port, () => {
  console.warn(`Running at localhost:${port}`);
});
