import { Storage } from "@google-cloud/storage";

export async function listBuckets(storage: Storage) {
    try {
        const [buckets] = await storage.getBuckets();
        buckets.forEach(bucket => {
            console.log(`Nome do bucket: ${bucket.name}`);
        });
    } catch (err) {
        console.error('Erro ao listar buckets:', err);
    }
}

export async function createBucket(storage: Storage, bucketName: string) {
    try {
        await storage.createBucket(bucketName);
        console.log(`Bucket ${bucketName} criado com sucesso.`);
    } catch (err) {
        console.error('Erro ao criar bucket:', err);
    }
}