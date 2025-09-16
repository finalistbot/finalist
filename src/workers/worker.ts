import { BracketClient } from "@/base/classes/client";
import { JobRegistry } from "./job-registry";
import { ScrimRegistrationHandler } from "./job-handlers";
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";

export function createWorker(client: BracketClient) {
  const jobRegistry = new JobRegistry();
  jobRegistry.register(
    "scrim_registration_start",
    new ScrimRegistrationHandler(client.scrimService),
  );

  const worker = new Worker(
    "finalist",
    async (job) => {
      const handler = jobRegistry.getHandler(job.name);
      if (!handler) {
        throw new Error(`No handler found for job: ${job.name}`);
      }
      if (!client.isReady()) {
        await job.moveToDelayed(Date.now() + 1000 * 10);
        return;
      }
      try {
        await handler.handle(job.data);
      } catch (error) {
        // TODO: better error handling
        throw error;
      }
    },
    {
      connection: redis,
    },
  );

  return worker;
}
