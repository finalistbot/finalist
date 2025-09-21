import { CheckFailure } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { Team } from "@prisma/client";
import {
  Interaction,
  CacheType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

function createBanTeamModal(team: Team) {
  return new ModalBuilder()
    .setCustomId(`ban_team_modal:${team.id}`)
    .setTitle(`Ban Team: ${team.name}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("ban_reason")
          .setLabel("Reason for Ban")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Enter the reason for banning this team...")
          .setRequired(false),
      ),
    );
}

export default class BanTeam extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("ban_team:")) return;
    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) return;
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { TeamMember: true },
    });
    if (!team) {
      await interaction.editReply({
        content: "Team not found.",
      });
      return;
    }
    if (team.banned) {
      await interaction.editReply({
        content: "Team is already banned.",
      });
      return;
    }
    const modal = createBanTeamModal(team);
    await interaction.showModal(modal);
  }
}
