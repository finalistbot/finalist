import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { Scrim } from "@prisma/client";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { CheckFailure } from "@/base/classes/error";

function teamConfigModal(scrim: Scrim & { _count: { Team: number } }) {
  const canChangeMaxPlayersPerTeam = scrim._count.Team === 0;
  const rows: ActionRowBuilder<TextInputBuilder>[] = [];
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("maxTeams")
        .setLabel("Maximum Teams")
        .setStyle(1)
        .setMinLength(1)
        .setMaxLength(3)
        .setValue(scrim.maxTeams.toString())
        .setPlaceholder("e.g., 25")
        .setRequired(true),
    ),
  );
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("minPlayersPerTeam")
        .setLabel("Minimum Players Per Team")
        .setStyle(1)
        .setMinLength(1)
        .setMaxLength(2)
        .setValue(scrim.minPlayersPerTeam.toString())
        .setPlaceholder("e.g., 4")
        .setRequired(true),
    ),
  );
  if (canChangeMaxPlayersPerTeam) {
    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("maxPlayersPerTeam")
          .setLabel("Maximum Players Per Team")
          .setStyle(1)
          .setMinLength(1)
          .setMaxLength(2)
          .setValue(scrim.maxPlayersPerTeam.toString())
          .setPlaceholder("e.g., 4")
          .setRequired(true),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("maxSubstitutePerTeam")
        .setLabel("Maximum Substitutes Per Team")
        .setStyle(1)
        .setMinLength(1)
        .setMaxLength(2)
        .setValue(scrim.maxSubstitutePerTeam.toString())
        .setPlaceholder("e.g., 1")
        .setRequired(true),
    ),
  );
  return new ModalBuilder()
    .setCustomId(`team_config_submit:${scrim.id}`)
    .setTitle("Team Configuration")
    .addComponents(...rows);
}

export default class ScrimTeamConfig extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("show_team_config_modal")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.reply({
        content: "Invalid scrim ID.",
        flags: ["Ephemeral"],
      });
      return;
    }
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
      include: { _count: { select: { Team: true } } },
    });
    if (!scrim) {
      return;
    }
    const modal = teamConfigModal(scrim);
    await interaction.showModal(modal);
  }
}
