// test-r2.js (SDK v3)
require('dotenv').config();
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

(async () => {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  const Bucket = process.env.BUCKET_NAME;
  const Key = `diagnostic/${Date.now()}_hello.txt`;

  try {
    // 1) PUT de teste
    await s3.send(new PutObjectCommand({
      Bucket, Key, Body: Buffer.from('hello R2'), ContentType: 'text/plain',
    }));
    console.log('✅ PutObject OK:', Key);

    // 2) LIST pra ver se aparece
    const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: 'diagnostic/' }));
    console.log('✅ ListObjects OK. Itens: ', (list.Contents || []).map(o => o.Key));
  } catch (e) {
    console.error('❌ Falha no R2:', e.message);
  }
})();
