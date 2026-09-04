import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const SEND_QUEUE_NAME = "email-send";

export interface SendJobData {
  emailSendId: string;
}

export const sendQueue = new Queue<SendJobData>(SEND_QUEUE_NAME, {
  connection: redisConnection,
});

/** Deterministic per-send job id so re-queuing the same EmailSend is a no-op. */
export function sendJobId(emailSendId: string): string {
  return `send:${emailSendId}`;
}

/**
 * Enqueues (or, if already queued/active/delayed, no-ops on) the SES send for
 * one EmailSend row. `delayMs` is how far in the future `scheduledFor` is -
 * clamped to 0 so already-due sends go out immediately.
 */
export async function enqueueSend(emailSendId: string, delayMs: number): Promise<void> {
  await sendQueue.add(
    "send",
    { emailSendId },
    {
      jobId: sendJobId(emailSendId),
      delay: Math.max(0, delayMs),
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}
