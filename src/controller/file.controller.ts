import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import type { Request, Response } from 'express';
import processFileMiddleware from '../middleware/upload';

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);
const gcsMainFolder = process.env.GCS_MAIN_FOLDER!;

export const upload = async (req: Request, res: Response): Promise<void> => {
  try {
    await processFileMiddleware(req, res);

    if (!req.file) {
      res.status(400).send({ message: 'Please upload a file!' });
      return;
    }

    const folders = req.body.folders as string;
    const timestamp = Date.now();
    const fileNameWithTimestamp = `${timestamp}_${req.file.originalname}`;
    const filePathInBucket = `${gcsMainFolder}/${folders}/${fileNameWithTimestamp}`;

    const blob = bucket.file(filePathInBucket);
    const blobStream = blob.createWriteStream({ resumable: false });

    blobStream.on('error', (err) => {
      res.status(500).send({ message: err.message });
    });

    blobStream.on('finish', async () => {
      const downloadUrl = await blob.getSignedUrl({
        action: 'read',
        expires: '2040-01-01',
      });

      const downloadLink = downloadUrl[0];
      res.setHeader('Content-Disposition', `attachment; filename="${req.file!.originalname}"`);
      res.status(200).send({
        status: 'OK',
        message: 'Uploaded the file successfully: ' + req.file!.originalname,
        url: downloadLink,
        originalName: req.file!.originalname,
        filenameTimestamp: fileNameWithTimestamp,
        size: req.file!.size,
        format: req.file!.mimetype,
      });
    });

    blobStream.end(req.file.buffer);
  } catch (err: any) {
    console.error(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).send({ message: 'File size cannot be larger than 10MB!' });
      return;
    }
    res.status(500).send({ message: `Could not upload the file. ${err.message}` });
  }
};

export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileName = req.query['fileName'] as string;
    const filePath = req.query['filePath']
      ? `${gcsMainFolder}/${req.query['filePath']}/${fileName}`
      : `${gcsMainFolder}/${fileName}`;

    await bucket.file(filePath).delete();
    res.status(200).send({ message: `File ${fileName} deleted successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to delete the file.' });
  }
};

export const getListFiles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [files] = await bucket.getFiles();
    const fileInfos = files.map(file => ({
      name: file.name,
      url: file.metadata['mediaLink'],
    }));
    res.status(200).send(fileInfos);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Unable to read list of files!' });
  }
};

export const criarBucket = async (_req: Request, res: Response): Promise<void> => {
  const bucketName = 'larfelizidade';
  try {
    await storage.createBucket(bucketName);
    res.status(200).send({ message: `Bucket ${bucketName} criado com sucesso.` });
  } catch (err: any) {
    console.error('Erro ao criar bucket:', err);
    res.status(500).send({ message: err.message });
  }
};

export const listBuckets = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [buckets] = await storage.getBuckets();
    res.status(200).send(buckets.map(b => b.name));
  } catch (err: any) {
    console.error('Erro ao listar buckets:', err);
    res.status(500).send({ message: err.message });
  }
};

export const download = async (req: Request, res: Response): Promise<void> => {
  try {
    const [metaData] = await bucket.file(req.params['name']).getMetadata();
    res.redirect(metaData['mediaLink'] as string);
  } catch (err: any) {
    res.status(500).send({ message: 'Could not download the file. ' + err.message });
  }
};
