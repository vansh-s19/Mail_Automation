import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const AUTOMATION_QUEUE_NAME = "automation-send";

export interface AutomationJobData {
  followUpId: string;
}

export const automationQueue = new Queue<AutomationJobData>(AUTOMATION_QUEUE_NAME, {
  connection: redisConnection,
});

/** Deterministic per-follow-up job id, mirroring sendJobId's dedup pattern. */
export function automationJobId(followUpId: string): string {
  return `automation:${followUpId}`;
}

export async function enqueueAutomationSend(followUpId: string, delayMs: number): Promise<void> {
  await automationQueue.add(
    "automation-send",
    { followUpId },
    {
      jobId: automationJobId(followUpId),
      delay: Math.max(0, delayMs),
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}
