import { promisify } from 'util';
import multer from 'multer';
import type { Request, Response } from 'express';

const maxSize = 10 * 1024 * 1024; // 10MB

const processFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize },
}).single('file');

const processFileMiddleware = promisify(processFile as any) as (req: Request, res: Response) => Promise<void>;

export default processFileMiddleware;
