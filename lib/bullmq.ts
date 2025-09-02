import { Queue, Worker } from "bullmq";
import { redis } from "./redis";
import { prisma } from "./prisma";
import { client } from "@/client";
import { openRegistration } from "@/services/scrim";
export const worker = new Worker(
  "discord-jobs",
  async (job) => {
    if (job.name.startsWith("scrim_registration_start")) {
      const [, _scrimId] = job.name.split(":");
      if (!_scrimId) {
        return;
      }
      const scrimId = parseInt(_scrimId);
      if (isNaN(scrimId)) {
        return;
      }
      await openRegistration(scrimId);
    }
  },
  { connection: redis },
);

export const queue = new Queue("discord-jobs", {
  connection: redis,
});
