import IORedis from "ioredis";
import { env } from "@mail-automation/config";

// BullMQ requires this exact setting on the ioredis connection it's given -
// it does its own retry/backoff handling and will misbehave otherwise.
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
