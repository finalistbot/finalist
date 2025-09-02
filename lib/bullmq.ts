import { Queue, Worker } from "bullmq";
import { redis } from "./redis";
import { prisma } from "./prisma";
import { client } from "@/client";
import { Scrim } from "@prisma/client";
import { TextChannel } from "discord.js";
import { createSlotListEmbed } from "@/commands/registerteam";

export async function sendInitialSlotListEmbed(scrim: Scrim) {
  const channel = await client.channels.fetch(scrim.registrationChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error("Registration channel not found or is not a text channel.");
  }

  const slotListEmbed = await createSlotListEmbed(scrim);
  const message = await channel.send({ embeds: [slotListEmbed] });

  await prisma.scrim.update({
    where: { id: scrim.id },
    data: { slotListMessageId: message.id },
  });
}

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
      await sendInitialSlotListEmbed(scrim);
    }
  },
  { connection: redis }
);

export const queue = new Queue("discord-jobs", {
  connection: redis,
});
