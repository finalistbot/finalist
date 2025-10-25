import { EmbedBuilder } from "discord.js";

import { Scrim } from "@prisma/client";

import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function slotListEmbed(scrim: Scrim) {
  const teams = await prisma.assignedSlot.findMany({
    where: { scrimId: scrim.id },
    orderBy: { slotNumber: "asc" },
  });
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`Slot List for Scrim ${scrim.id}`)
    .setDescription("List of assigned slots for the scrim.")
    .addFields(
      teams.map((t) => ({
        name: `Slot ${t.slotNumber}`,
        value: `Team ID: ${t.registeredTeamId}`,
        inline: true,
      }))
    );

  return embed;
}
