import { Queue, Worker } from "bullmq";
import { redis } from "./redis";
import { openRegistration } from "@/services/scrim";
export const worker = new Worker(
  "bracket-tournament",
  async (job) => {
    if (job.name == "scrim_registration_start") {
      const { scrimId } = job.data;
      await openRegistration(scrimId);
    }
  },
  { connection: redis },
);

export const queue = new Queue("bracket-tournament", {
  connection: redis,
});
