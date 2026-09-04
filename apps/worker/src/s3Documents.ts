import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireS3Config } from "@mail-automation/config";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const config = requireS3Config();
    client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function fetchPdfBytes(key: string): Promise<Buffer> {
  const config = requireS3Config();
  const response = await getClient().send(new GetObjectCommand({ Bucket: config.S3_DOCUMENTS_BUCKET, Key: key }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`S3 object ${key} had no body`);
  }
  return Buffer.from(bytes);
}
