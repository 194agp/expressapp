const docxConverter = require('docx-pdf');
const path = require('path');
const fs = require('fs');

// Função para converter DOCX para PDF
const convertDocxToPdf = async (req, res) => {
    // Definir o diretório de uploads
    const uploadDir = 'uploads';

    // Verificar se o diretório de uploads existe e criar se não existir
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    // Definir os caminhos dos arquivos
    const docxFilePath = path.join(uploadDir, req.file.originalname);
    const pdfFilePath = path.join(uploadDir, 'output.pdf');

    try {
        // Verifica se o arquivo foi enviado
        if (!req.file) {
            return res.status(400).send({ message: "Please upload a DOCX file!" });
        }

        // Salvar o arquivo DOCX enviado
        fs.writeFileSync(docxFilePath, req.file.buffer);

        // Converter o arquivo DOCX para PDF
        docxConverter(docxFilePath, pdfFilePath, (err, result) => {
            if (err) {
                console.error('Error converting DOCX to PDF:', err);
                return res.status(500).send('Error converting DOCX to PDF');
            }

            // Enviar o arquivo PDF convertido para o cliente
            res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
            res.setHeader('Content-Type', 'application/pdf');
            fs.createReadStream(pdfFilePath).pipe(res);
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error occurred during processing');
    } finally {
        // Limpeza dos arquivos temporários
        if (fs.existsSync(docxFilePath)) fs.unlinkSync(docxFilePath);
        if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
    }
};

module.exports = {
    convertDocxToPdf, // Exportar a função de conversão
};
