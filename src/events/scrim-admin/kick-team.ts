import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, suppress } from "@/lib/utils";
import { Interaction, CacheType } from "discord.js";

export default class KickTeam extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("kick_team:")) return;

    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
      await interaction.reply({
        content: "Invalid team ID.",
        flags: "Ephemeral",
      });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      await interaction.reply({
        content: `Team with ID ${teamId} does not exist.`,
        flags: "Ephemeral",
      });
      return;
    }

    if (team.messageId) {
      await suppress(interaction.channel?.messages.delete(team.messageId));
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        registeredAt: null,
        messageId: null,
      },
    });

    await interaction.reply({
      content: `Team with ID ${teamId} has been kicked.`,
      flags: "Ephemeral",
    });
  }
}
