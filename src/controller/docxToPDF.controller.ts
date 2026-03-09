import docxConverter from 'docx-pdf';
import path from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';

function sanitizeFileName(name: string): string {
  return path.basename(name).replace(/[^\w.\-]+/g, '_') || 'upload.docx';
}

export const convertDocxToPdf = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).send({ message: 'Por favor, envie um arquivo DOCX.' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.docx') {
    res.status(400).send({ message: 'Apenas arquivos .docx são aceitos.' });
    return;
  }

  const uploadDir = path.resolve('uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const safeName = sanitizeFileName(req.file.originalname);
  const docxFilePath = path.join(uploadDir, `${Date.now()}_${safeName}`);
  const pdfFilePath = docxFilePath.replace(/\.docx$/i, '.pdf');

  function cleanup() {
    if (fs.existsSync(docxFilePath)) fs.unlinkSync(docxFilePath);
    if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
  }

  try {
    fs.writeFileSync(docxFilePath, req.file.buffer);

    (docxConverter as Function)(docxFilePath, pdfFilePath, (err: Error | null) => {
      if (err) {
        console.error('Erro ao converter DOCX para PDF:', err);
        cleanup();
        res.status(500).send({ message: 'Erro ao converter o arquivo.' });
        return;
      }

      res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
      res.setHeader('Content-Type', 'application/pdf');

      const stream = fs.createReadStream(pdfFilePath);
      stream.pipe(res);

      // Limpeza APÓS o stream fechar
      stream.on('close', cleanup);
      stream.on('error', (streamErr) => {
        console.error('Erro ao enviar PDF:', streamErr);
        cleanup();
      });
    });
  } catch (error) {
    console.error('Erro ao processar conversão:', error);
    cleanup();
    res.status(500).send({ message: 'Erro ao processar o arquivo.' });
  }
};
