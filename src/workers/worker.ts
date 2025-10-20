import { BracketClient } from "@/base/classes/client";
import { JobRegistry } from "./job-registry";
import {
  ScrimAutoCleanHandler,
  ScrimRegistrationHandler,
} from "./job-handlers";
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { SCRIM_AUTO_CLEAN, SCRIM_REGISTRATION_START } from "@/lib/constants";

export function createWorker(client: BracketClient) {
  const jobRegistry = new JobRegistry();
  jobRegistry.register(
    SCRIM_REGISTRATION_START,
    new ScrimRegistrationHandler(client.scrimService)
  );
  jobRegistry.register(
    SCRIM_AUTO_CLEAN,
    new ScrimAutoCleanHandler(client.scrimService)
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
        throw new Error("Client is not ready");
      }
      try {
        await handler.handle(job);
      } catch (error) {
        console.error(`Error processing job ${job.id} (${job.name}):`, error);
        throw error;
      }
    },
    {
      connection: redis,
      settings: {
        backoffStrategy: (attempts) => {
          return 10000 * attempts;
        },
      },
    }
  );

  return worker;
}
