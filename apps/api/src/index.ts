import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { env } from "@mail-automation/config";
import authRoutes from "./routes/auth";
import contactsRoutes from "./routes/contacts";
import templatesRoutes from "./routes/templates";
import campaignsRoutes from "./routes/campaigns";
import dailyQueueRoutes from "./routes/dailyQueue";
import documentsRoutes from "./routes/documents";
import emailSendsRoutes from "./routes/emailSends";
import publicRoutes from "./routes/public";
import sesWebhookRoutes from "./routes/sesWebhook";
import trackOpenRoutes from "./routes/trackOpen";

const app = express();

app.use(cors());

// SNS posts notifications as `text/plain`, not JSON - must be registered
// before the app-wide express.json() so this path gets a raw text body instead.
app.use("/sns", express.text({ type: "*/*" }), sesWebhookRoutes);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/contacts", contactsRoutes);
app.use("/templates", templatesRoutes);
app.use("/campaigns", campaignsRoutes);
app.use("/daily-queue", dailyQueueRoutes);
app.use("/documents", documentsRoutes);
app.use("/email-sends", emailSendsRoutes);
app.use("/track", trackOpenRoutes);
app.use("/", publicRoutes);

// Catches anything asyncHandler forwards via next(err), plus sync throws in
// route handlers - keeps one bad request from crashing the whole process.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
