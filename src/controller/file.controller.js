const processFile = require("../middleware/upload");
const { format } = require("util");
const { Storage } = require("@google-cloud/storage");

require('dotenv').config();
const path = require('path');

const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
});

const bucket = storage.bucket(process.env.BUCKET_CODEMAR);
const gcsMainFolder = process.env.GCS_MAIN_FOLDER

// Função para fazer upload de um arquivo para o Cloud Storage
async function uploadFile(fileName, filePath) {
    try {
        await storage.bucket(bucketName).upload(filePath, {
            destination: fileName,
            // Você pode adicionar opções adicionais aqui, como metadados do arquivo
        });
        console.log(`Arquivo ${fileName} enviado para o Cloud Storage.`);
    } catch (err) {
        console.error('Erro ao enviar arquivo para o Cloud Storage:', err);
    }
}

const upload = async (req, res) => {
    try {
        await processFile(req, res);

        if (!req.file) {
            return res.status(400).send({ message: "Please upload a file!" });
        }

        const folders = req.body.folders
        const timestamp = Date.now();
        const fileNameWithTimestamp = `${timestamp}_${req.file.originalname}`;
        const filePathInBucket = `${gcsMainFolder}/${folders}/${fileNameWithTimestamp}`;

        const blob = bucket.file(filePathInBucket);
        const blobStream = blob.createWriteStream({ resumable: false, });

        blobStream.on("error", (err) => {
            res.status(500).send({ message: err.message });
        });

        blobStream.on("finish", async (data) => {
            const publicUrl = format(
                `https://storage.googleapis.com/${bucket.name}/${gcsMainFolder}/${blob.name}`
            );

            const downloadUrl = await blob.getSignedUrl({
                action: 'read',
                expires: '2040-01-01', // Defina a expiração do URL conforme necessário
            });
            try {
                // await bucket.file(req.file.originalname).makePublic();
            } catch {
                return res.status(500).send({
                    message:
                        `Uploaded the file successfully: ${req.file.originalname}, but public access is denied!`,
                    url: publicUrl,
                });
            }

            // Gerar o link de download
            const downloadLink = downloadUrl[0];

            // Definir o cabeçalho Content-Disposition para forçar o navegador a baixar o arquivo
            res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname}"`);

            res.status(200).send({
                status: 'OK',
                message: "Uploaded the file successfully: " + req.file.originalname,
                url: downloadLink,
                originalName: req.file.originalname,
                filenameTimestamp: fileNameWithTimestamp,
                size: req.file.size,
                format: req.file.mimetype,
            });
        });

        blobStream.end(req.file.buffer);
    } catch (err) {
        console.error(err);

        if (err.code == "LIMIT_FILE_SIZE") {
            return res.status(500).send({
                message: "File size cannot be larger than 10MB!",
            });
        }

        res.status(500).send({
            message: `Could not upload the file: ${req.file.originalname}. ${err}`,
        });
    }
};

const deleteFile = async (req, res) => {
    try {
        const fileName = req.query.fileName;
        const filePath = req.query.filePath ? `${gcsMainFolder}/${req.query.filePath}/${fileName}` : `${gcsMainFolder}/${fileName}`;

        const deletedFile = await bucket.file(filePath).delete();

        res.status(200).send({ message: `File ${fileName} deleted successfully.`, deletedFile });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to delete the file." });
    }
}

const getListFiles = async (req, res) => {
    try {
        const [files] = await bucket.getFiles();
        let fileInfos = [];

        files.forEach((file) => {
            fileInfos.push({
                name: file.name,
                url: file.metadata.mediaLink,
            });
        });

        res.status(200).send(fileInfos);
    } catch (err) {
        console.error(err);

        res.status(500).send({
            message: "Unable to read list of files!",
        });
    }
};

const criarBucket = async () => {
    const bucketName = 'larfelizidade'
    try {
        await storage.createBucket(bucketName);
        console.log(`Bucket ${bucketName} criado com sucesso.`);
    } catch (err) {
        console.error('Erro ao criar bucket:', err);
    }
}

const listBuckets = async () => {
    try {
        const [buckets] = await storage.getBuckets();
        console.log(buckets)
        buckets.forEach(bucket => {
            console.log(`Nome do bucket: ${bucket.name}`);
        });
    } catch (err) {
        console.error('Erro ao listar buckets:', err);
    }
}

const download = async (req, res) => {
    try {
        const [metaData] = await bucket.file(req.params.name).getMetadata();
        res.redirect(metaData.mediaLink);

    } catch (err) {
        res.status(500).send({
            message: "Could not download the file. " + err,
        });
    }
};

module.exports = {
    upload,
    getListFiles,
    listBuckets,
    criarBucket,
    download,
    deleteFile,
};