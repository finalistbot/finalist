import { prisma } from "@/lib/prisma";
import { Scrim } from "@prisma/client";
import {  EmbedBuilder } from "discord.js";

export async function slotListEmbed(scrim: Scrim) {
  const teams = await prisma.assignedSlot.findMany({
    where: { scrimId: scrim.id },
    orderBy: { slotNumber: "asc" },
  });
  const embed = new EmbedBuilder().setColor("Green").setTitle(`Slot List for Scrim ${scrim.id}`).setDescription("List of assigned slots for the scrim.").addFields(
    teams.map((t) => ({
      name: `Slot ${t.slotNumber}`,
      value: `Team ID: ${t.teamId}`,
      inline: true,
    })),
  );

  return embed;
}