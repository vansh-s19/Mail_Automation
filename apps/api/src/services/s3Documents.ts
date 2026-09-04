import crypto from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export async function uploadPdf(buffer: Buffer, originalName: string): Promise<{ key: string }> {
  const config = requireS3Config();
  // Random prefix, not the original filename, as the S3 key - avoids
  // collisions between two uploads named "brochure.pdf" and keeps the key
  // opaque (the human-readable name lives in PdfDocument.name instead).
  const key = `documents/${crypto.randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: config.S3_DOCUMENTS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    })
  );

  return { key };
}

export async function deletePdf(key: string): Promise<void> {
  const config = requireS3Config();
  await getClient().send(new DeleteObjectCommand({ Bucket: config.S3_DOCUMENTS_BUCKET, Key: key }));
}
