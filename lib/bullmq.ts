import { Queue, Worker } from "bullmq";
import { redis } from "./redis";
import { prisma } from "./prisma";
import { client } from "@/client";

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
      const scrim = await prisma.scrim.findUnique({
        where: { id: scrimId },
      });
      if (!scrim) {
        return;
      }
      const guild = client.guilds.cache.get(scrim.guildId);
      const channel = guild?.channels.cache.get(scrim.registrationChannelId);
      if (!channel || !guild) {
        return;
      }
      await channel.edit({
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
          },
        ],
      });
    }
  },
  { connection: redis },
);

export const queue = new Queue("discord-jobs", {
  connection: redis,
});
