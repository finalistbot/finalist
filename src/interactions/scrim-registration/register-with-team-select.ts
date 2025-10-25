import { ButtonInteraction, EmbedBuilder, Interaction } from "discord.js";

import { BracketError } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export default class RegisterWithTeamSelect extends IdentityInteraction<"button"> {
  id = "register_team_for_registration";
  type = "button" as const;
  async execute(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inGuild()) return;

    await interaction.deferUpdate();
    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    });
    if (!scrim) return;

    const teamId = parseInt(interaction.customId.split(":")[1]!);
    const team = await prisma.team.findUnique({
      where: { id: teamId, guildId: interaction.guildId! },
      include: { teamMembers: true },
    });
    if (!team) {
      await interaction.editReply({ content: "Team not found." });
      return;
    }

    let registeredTeam;
    try {
      registeredTeam = await this.client.scrimService.registerTeam(scrim, team);
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({
          content: error.message,
          embeds: [],
          components: [],
        });
      }
      throw error;
    }

    const embed = new EmbedBuilder()
      .setTitle("✅ Team Registered")
      .setDescription(
        `Team **${registeredTeam.name}** has been successfully registered for the scrim!`
      )
      .setColor(BRAND_COLOR);

    await interaction.editReply({
      embeds: [embed],
      components: [],
      content: null,
    });
  }
}
