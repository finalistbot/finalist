import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { Scrim } from "@prisma/client";
import { parseIdFromString } from "@/lib/utils";

function teamConfigModal(scrim: Scrim) {
  return new ModalBuilder()
    .setCustomId(`team_config_submit:${scrim.id}`)
    .setTitle("Team Configuration")
    .addComponents(
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
}

export default class ScrimTeamConfig extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("show_team_config_modal")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      return;
    }
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      return;
    }
    const modal = teamConfigModal(scrim);
    await interaction.showModal(modal);
  }
}
