import { Event } from "@/base/classes/event";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { RegisteredTeam, Team } from "@prisma/client";
import {
  Interaction,
  CacheType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

function createBanTeamModal(team: RegisteredTeam) {
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
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.reply({
        content: checkResult.reason,
        flags: ["Ephemeral"],
      });
      return;
    }
    const registeredTeam = await prisma.registeredTeam.findUnique({
      where: { id: teamId },
      include: { team: true },
    });
    if (!registeredTeam) {
      await interaction.reply({
        content: "Team not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    if (registeredTeam.team.banned) {
      await interaction.reply({
        content: "Team is already banned.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const modal = createBanTeamModal(registeredTeam);
    await interaction.showModal(modal);
  }
}
