import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { prisma } from "@/lib/prisma";
import { Scrim } from "@prisma/client";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { isScrimAdmin } from "@/checks/scrim-admin";
import z from "zod";
import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { v4 as uuid4 } from "uuid";

const TeamConfigSchema = z.object({
  maxTeams: z.coerce.number().min(2).max(999),
  minPlayersPerTeam: z.coerce.number().min(1).max(99),
  maxPlayersPerTeam: z.coerce.number().min(1).max(99),
  maxSubstitutePerTeam: z.coerce.number().min(0).max(99).default(0),
});

function teamConfigModal(
  scrim: Scrim & { _count: { registeredTeams: number } }
) {
  const canChangeMaxPlayersPerTeam = scrim._count.registeredTeams === 0;
  const rows = [];
  rows.push(
    new LabelBuilder()
      .setLabel("Maximum Teams")
      .setDescription(
        `Current: ${scrim.maxTeams}. The maximum number of teams that can register for this scrim.`
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("maxTeams")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(3)
          .setValue(scrim.maxTeams.toString())
          .setPlaceholder("e.g., 25")
          .setRequired(true)
      )
  );
  rows.push(
    new LabelBuilder()
      .setLabel("Minimum Players Per Team")
      .setDescription(
        `Current: ${scrim.minPlayersPerTeam}. The minimum number of players required per team.`
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("minPlayersPerTeam")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(2)
          .setValue(scrim.minPlayersPerTeam.toString())
          .setPlaceholder("e.g., 4")
          .setRequired(true)
      )
  );
  if (canChangeMaxPlayersPerTeam) {
    rows.push(
      new LabelBuilder()
        .setLabel("Maximum Players Per Team")
        .setDescription(
          `Current: ${scrim.maxPlayersPerTeam}. The maximum number of players allowed per team.`
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("maxPlayersPerTeam")
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(2)
            .setValue(scrim.maxPlayersPerTeam.toString())
            .setPlaceholder("e.g., 4")
            .setRequired(true)
        )
    );
  }
  rows.push(
    new LabelBuilder()
      .setLabel("Maximum Substitutes Per Team")
      .setDescription(
        `Current: ${scrim.maxSubstitutePerTeam}. The maximum number of substitutes allowed per team.`
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("maxSubstitutePerTeam")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(2)
          .setValue(scrim.maxSubstitutePerTeam.toString())
          .setPlaceholder("e.g., 1")
          .setRequired(true)
      )
  );
  return new ModalBuilder()
    .setTitle("Team Configuration")
    .addLabelComponents(...rows);
}

export default class ScrimTeamConfig extends IdentityInteraction<"button"> {
  id = "show_team_config_modal";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.reply({
        content: "Invalid scrim ID.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.reply({
        content: checkResult.reason,
        flags: ["Ephemeral"],
      });
      return;
    }
    let scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      await interaction.reply({
        content: "Scrim not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const registeredTeamsCount = await prisma.registeredTeam.count({
      where: { scrimId: scrim.id },
    });
    const modal = teamConfigModal({
      ...scrim,
      _count: { registeredTeams: registeredTeamsCount },
    });
    const modalId = uuid4();
    modal.setCustomId(modalId);
    await interaction.showModal(modal);

    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.customId === modalId && i.user.id === interaction.user.id,
    });
    await modalSubmit.deferReply({ flags: ["Ephemeral"] });

    const rawBody = {
      maxTeams: modalSubmit.fields.getTextInputValue("maxTeams"),
      minPlayersPerTeam:
        modalSubmit.fields.getTextInputValue("minPlayersPerTeam"),
      maxPlayersPerTeam:
        modalSubmit.fields.getTextInputValue("maxPlayersPerTeam"),
      maxSubstitutePerTeam: modalSubmit.fields.getTextInputValue(
        "maxSubstitutePerTeam"
      ),
    };

    const parsed = TeamConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await modalSubmit.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const data = parsed.data;

    if (data.minPlayersPerTeam > data.maxPlayersPerTeam) {
      await modalSubmit.editReply({
        content: `Minimum players per team cannot be greater than maximum players per team.`,
      });
      return;
    }

    scrim = await prisma.scrim.update({
      where: {
        id: scrimId,
      },
      data: {
        maxTeams: data.maxTeams,
        minPlayersPerTeam: data.minPlayersPerTeam,
        maxPlayersPerTeam: data.maxPlayersPerTeam,
        maxSubstitutePerTeam: data.maxSubstitutePerTeam,
      },
    });
    await modalSubmit.editReply({
      content: `Team configuration updated successfully!`,
    });
    await this.client.scrimService.updateScrimConfigMessage(scrim);
  }
}
