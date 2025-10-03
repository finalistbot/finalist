import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";

import teamDetailsEmbed from "@/ui/embeds/team-details";

export default class TeamSelectHandler extends Event<"interactionCreate"> {
  event = "interactionCreate" as const;

  async execute(interaction: Interaction<"cached">): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "select_team_for_registration") return;
    if (!interaction.inGuild()) return;

    await interaction.deferUpdate();

    const teamId = parseInt(interaction.values[0]!);
    const team = await prisma.team.findUnique({
      where: { id: teamId, guildId: interaction.guildId! },
      include: { teamMembers: true },
    });
    if (!team) {
      await interaction.editReply({ content: "Team not found." });
      return;
    }

    const embed = await teamDetailsEmbed(team);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`register_team_for_registration:${team.id}`)
        .setLabel("Register Team")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row],
      content: "Click below to confirm registration.",
    });
  }
}
