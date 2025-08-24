// controllers/s3.controller.js
require('dotenv').config();
const multer   = require('multer');
const multerS3 = require('multer-s3');
const s3       = require('../config/s3');

const bucketName = process.env.BUCKET_NAME;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB em bytes

// --- Configuração do multer-s3 com limite de 5MB ---
const upload = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId    = req.user?.id ?? 'guest';
      const timestamp = Date.now();
      const safeName  = file.originalname.replace(/\s+/g, '_');
      cb(null, `user_${userId}/${timestamp}_${safeName}`);
    }
  }),
  limits: { fileSize: MAX_SIZE },           // aqui
  fileFilter: (req, file, cb) => {
    // aceitar qualquer tipo de arquivo
    cb(null, true);
  }
});

const uploadFileMiddleware = upload.single('file');  // campo 'file'

/**
 * Handler de upload: retorna URL pública e 'key'
 */
function uploadFileHandler(req, res) {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: 'Nenhum arquivo enviado no campo "file", ou excedeu 5 MB.' });
  }
  res.json({
    url: req.file.location,
    key: req.file.key
  });
}

/**
 * Handler de deleção: apaga pelo 'key'
 */
async function deleteFileHandler(req, res) {
  const { key } = req.body;
  if (!key) {
    return res
      .status(400)
      .json({ error: 'Informe o "key" do objeto a ser deletado.' });
  }

  try {
    await s3.deleteObject({
      Bucket: bucketName,
      Key: key
    }).promise();

    res.json({ message: 'Arquivo deletado.', key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar arquivo.', details: err.message });
  }
}

module.exports = {
  uploadFileMiddleware,
  uploadFileHandler,
  deleteFileHandler
};
