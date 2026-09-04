import crypto from "node:crypto";
import { env } from "@mail-automation/config";

/**
 * Stateless signed token identifying a contact for the public unsubscribe
 * link - no separate "tokens" table needed, verification is just re-computing
 * the HMAC. Deliberately not a JWT (those are the wrong shape for a link that
 * should never expire - unsubscribe must keep working years later).
 */
export function generateUnsubscribeToken(contactId: string): string {
  const payload = Buffer.from(contactId, "utf8").toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
}
