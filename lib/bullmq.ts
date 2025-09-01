import { Queue, Worker } from "bullmq";
import { redis } from "./redis";

export const worker = new Worker(
  "discord-jobs",
  async (job) => {
    console.log(`Processing job ${job.id} of type ${job.name}`);
  },
  { connection: redis },
);

export const queue = new Queue("discord-jobs", {
  connection: redis,
});
