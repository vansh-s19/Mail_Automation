import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@mail-automation/db";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { uploadPdf, deletePdf } from "../services/s3Documents";

const router = Router();

router.use(requireAuth);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB - plenty for a sales PDF, keeps the S3 bill and upload time trivial
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", asyncHandler(async (_req, res) => {
  const documents = await prisma.pdfDocument.findMany({ orderBy: { createdAt: "desc" } });
  res.json(documents);
}));

router.post("/", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded (expected a single 'file' field)" });
  }

  const { key } = await uploadPdf(req.file.buffer, req.file.originalname);

  const document = await prisma.pdfDocument.create({
    data: {
      name: req.body.name?.trim() || req.file.originalname,
      s3Key: key,
      sizeBytes: req.file.size,
    },
  });
  res.status(201).json(document);
}));

const renameSchema = z.object({ name: z.string().min(1) });

router.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid update payload" });
  }
  try {
    const document = await prisma.pdfDocument.update({ where: { id: req.params.id }, data: { name: parsed.data.name } });
    res.json(document);
  } catch {
    res.status(404).json({ error: "Document not found" });
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const document = await prisma.pdfDocument.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Document not found" });

  const stepCount = await prisma.sequenceStep.count({ where: { attachmentId: document.id } });
  if (stepCount > 0) {
    return res.status(409).json({ error: "Document is attached to one or more sequence steps" });
  }

  await deletePdf(document.s3Key);
  await prisma.pdfDocument.delete({ where: { id: document.id } });
  res.status(204).send();
}));

// Surface multer's file-too-large / wrong-mimetype errors as 400s instead of
// letting them fall through to the generic 500 handler.
router.use((err: Error, _req: unknown, res: import("express").Response, next: import("express").NextFunction) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

export default router;
