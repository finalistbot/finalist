import { EmbedBuilder, Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { BracketError } from "@/base/classes/error";
import { BRAND_COLOR } from "@/lib/constants";

export default class RegisterWithTeamSelect extends Event<"interactionCreate"> {
  event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("register_team_for_registration:"))
      return;
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
        await interaction.editReply({ content: error.message });
      }
      throw error;
    }

    const embed = new EmbedBuilder()
      .setTitle("✅ Team Registered")
      .setDescription(
        `Team **${registeredTeam.name}** has been successfully registered for the scrim!`,
      )
      .setColor(BRAND_COLOR);

    await interaction.editReply({
      embeds: [embed],
      components: [],
      content: null,
    });
  }
}
