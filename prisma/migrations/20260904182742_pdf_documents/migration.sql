-- AlterTable
ALTER TABLE "sequence_steps" ADD COLUMN     "attachment_id" TEXT;

-- CreateTable
CREATE TABLE "pdf_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "pdf_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
