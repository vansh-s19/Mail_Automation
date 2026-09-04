import { Worker } from "bullmq";
import {
  redisConnection,
  SEND_QUEUE_NAME,
  AUTOMATION_QUEUE_NAME,
  type SendJobData,
  type AutomationJobData,
} from "@mail-automation/queue";
import { processSendJob } from "./processSend";
import { processAutomationSendJob } from "./processAutomationSend";

// Kept just under SES's per-second send rate (a technical throughput limit,
// separate from each campaign's own dailySendCap business-rule counter).
const SES_SENDS_PER_SECOND = 10;

const sendWorker = new Worker<SendJobData>(SEND_QUEUE_NAME, processSendJob, {
  connection: redisConnection,
  limiter: { max: SES_SENDS_PER_SECOND, duration: 1000 },
  concurrency: SES_SENDS_PER_SECOND,
});

sendWorker.on("completed", (job) => {
  console.log(`[worker] sent ${job.data.emailSendId}`);
});

sendWorker.on("failed", (job, err) => {
  console.error(`[worker] send failed for ${job?.data.emailSendId}:`, err.message);
});

// Same SES rate limit applies here too - it's a shared account-level cap, not
// per-queue, but BullMQ limiters are per-Worker, so this one is kept small
// (automation volume is inherently a fraction of primary sequence volume).
const automationWorker = new Worker<AutomationJobData>(AUTOMATION_QUEUE_NAME, processAutomationSendJob, {
  connection: redisConnection,
  limiter: { max: 5, duration: 1000 },
  concurrency: 5,
});

automationWorker.on("completed", (job) => {
  console.log(`[worker] automation follow-up sent ${job.data.followUpId}`);
});

automationWorker.on("failed", (job, err) => {
  console.error(`[worker] automation follow-up failed for ${job?.data.followUpId}:`, err.message);
});

console.log("Email send worker listening on queues:", SEND_QUEUE_NAME, AUTOMATION_QUEUE_NAME);

process.on("SIGTERM", async () => {
  await Promise.all([sendWorker.close(), automationWorker.close()]);
  process.exit(0);
});
