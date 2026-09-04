import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Workspace scripts run with cwd set to the individual package (e.g. apps/api),
// so resolve the repo-root .env explicitly instead of relying on dotenv's default cwd lookup.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),

  PORT: z.coerce.number().default(4000),
  // Where the public /unsubscribe link points - must be the API's real
  // reachable URL once deployed (Railway), not the frontend's.
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),

  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  SES_FROM_ADDRESS: z.string().optional(),
  // Optional: ties sends to an SES configuration set so bounce/complaint/delivery
  // events get published to the SNS topic the webhook receiver listens on.
  SES_CONFIGURATION_SET: z.string().optional(),
  // Shared secret appended to the SNS webhook URL as a query param so the
  // endpoint isn't wide open to anyone who finds it - SNS itself has no
  // built-in request auth for HTTP(S) subscriptions.
  SNS_WEBHOOK_SECRET: z.string().optional(),
  // S3 bucket for the PDF Library (Documents feature) - reuses the same AWS
  // account/region as SES, just a separate bucket + scoped IAM policy.
  S3_DOCUMENTS_BUCKET: z.string().optional(),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  SHEET_ID: z.string().optional(),
  SHEET_RANGE: z.string().default("Sheet1!A:H"),

  IMAP_HOST: z.string().optional(),
  IMAP_USER: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),

  DEFAULT_DAILY_SEND_CAP: z.coerce.number().default(100),
  DEFAULT_BUSINESS_HOURS_START: z.coerce.number().default(9),
  DEFAULT_BUSINESS_HOURS_END: z.coerce.number().default(17),
  DEFAULT_TIMEZONE_FALLBACK: z.string().default("America/New_York"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export function requireSesConfig() {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SES_FROM_ADDRESS } = env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !SES_FROM_ADDRESS) {
    throw new Error(
      "AWS SES is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and SES_FROM_ADDRESS."
    );
  }
  return { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SES_FROM_ADDRESS };
}

export function requireS3Config() {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_DOCUMENTS_BUCKET } = env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_DOCUMENTS_BUCKET) {
    throw new Error(
      "S3 document storage is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_DOCUMENTS_BUCKET."
    );
  }
  return { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_DOCUMENTS_BUCKET };
}

export function requireGoogleSheetsConfig() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SHEET_ID } = env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    throw new Error(
      "Google Sheets sync is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and SHEET_ID."
    );
  }
  return { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SHEET_ID };
}
