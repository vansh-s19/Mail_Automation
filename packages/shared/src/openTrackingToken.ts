import crypto from "node:crypto";
import { env } from "@mail-automation/config";

// Same stateless-HMAC shape as unsubscribeToken.ts, but signs a namespaced
// payload ("open:<id>") so a token minted for one purpose can't be replayed
// against the other endpoint even though both are unsigned public GETs.
const NAMESPACE = "open";

export function generateOpenTrackingToken(emailSendId: string): string {
  const payload = Buffer.from(`${NAMESPACE}:${emailSendId}`, "utf8").toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyOpenTrackingToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const [namespace, emailSendId] = decoded.split(":");
    if (namespace !== NAMESPACE || !emailSendId) return null;
    return emailSendId;
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
}
