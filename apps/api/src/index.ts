import express from "express";
import cors from "cors";
import { env } from "@mail-automation/config";
import authRoutes from "./routes/auth";
import contactsRoutes from "./routes/contacts";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/contacts", contactsRoutes);

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
