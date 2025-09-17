import { BracketClient } from "@/base/classes/client";
import { JobRegistry } from "./job-registry";
import { ScrimRegistrationHandler } from "./job-handlers";
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { SCRIM_REGISTRATION_START } from "@/lib/constants";

export function createWorker(client: BracketClient) {
  const jobRegistry = new JobRegistry();
  jobRegistry.register(
    SCRIM_REGISTRATION_START,
    new ScrimRegistrationHandler(client.scrimService),
  );

  const worker = new Worker(
    "finalist",
    async (job) => {
      console.log(`Processing job ${job.id} (${job.name})`);
      const handler = jobRegistry.getHandler(job.name);
      if (!handler) {
        throw new Error(`No handler found for job: ${job.name}`);
      }
      if (!client.isReady()) {
        await job.moveToDelayed(Date.now() + 1000 * 10);
        console.log(
          `Client not ready, delaying job ${job.id} (${job.name}) by 10 seconds`,
        );
        return;
      }
      try {
        await handler.handle(job);
      } catch (error) {
        // TODO: better error handling
        console.error(`Error processing job ${job.id} (${job.name}):`, error);
        throw error;
      }
    },
    {
      connection: redis,
    },
  );

  return worker;
}
