import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { RegisteredTeam } from "@prisma/client";
import { v4 as uuid4 } from "uuid";

import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";

function createBanTeamModal(team: RegisteredTeam) {
  return new ModalBuilder()
    .setTitle(`Ban Team: ${team.name}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Ban Reason")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("ban_reason")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(0)
            .setMaxLength(400)
            .setPlaceholder("Enter the reason for banning this team (optional)")
            .setRequired(false)
        )
    );
}

export default class BanTeam extends IdentityInteraction<"button"> {
  id = "ban_team";
  type = "button" as const;
  async execute(interaction: ButtonInteraction): Promise<void> {
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
    const modalId = uuid4();
    modal.setCustomId(modalId);
    await interaction.showModal(modal);
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === modalId,
    });
    await modalSubmit.deferReply({ flags: ["Ephemeral"] });
    const team = await prisma.registeredTeam.findUnique({
      where: { id: teamId },
      include: { registeredTeamMembers: true },
    });
    if (!team) {
      await modalSubmit.editReply({
        content: "Team not found.",
      });
      return;
    }
    const banReason = modalSubmit.fields.getTextInputValue("ban_reason");
    await prisma.team.update({
      where: { id: team.teamId },
      data: { banned: true, banReason: banReason || null },
    });
    await this.client.eventLogger.logEvent("teamBanned", {
      team,
      trigger: {
        userId: interaction.user.id,
        username: interaction.user.username,
        type: "user",
      },
    });
    await this.client.scrimService.unregisterTeam(team);
    await modalSubmit.editReply({
      content: `Team **${team.name}** has been banned.${banReason ? ` Reason: ${banReason}` : ""}\n\nThis ban is only for this scrim. To permanently ban a team, please use \`/ban\`.`,
    });
  }
}
