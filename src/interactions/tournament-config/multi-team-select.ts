import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { BracketError } from "@/base/classes/error";
import { prisma } from "@/lib/prisma";
import {
  ActionRowBuilder,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { parseIdFromString } from "@/lib/utils";

export class ShowMultiTeamSelect extends IdentityInteraction<"button"> {
  type = "button" as const;
  id = "show_multi_team_select";

  async execute(interaction: ButtonInteraction) {
    const tournamentId = parseIdFromString(interaction.customId);
    if (!tournamentId) {
      await interaction.reply({
        content: "Invalid tournament ID.",
        ephemeral: true,
      });
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      await interaction.reply({
        content: "Tournament not found.",
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`multi_team_select:${tournamentId}`)
      .setPlaceholder("Select match format")
      .addOptions(
        {
          label: "Standard (1v1)",
          value: "false",
          description: "Traditional head-to-head matches between two teams",
          default: !tournament.isMultiTeam,
        },
        {
          label: "Multi-Team (Battle Royale)",
          value: "true",
          description: "Matches with multiple teams (e.g., PUBG, Fortnite)",
          default: tournament.isMultiTeam,
        }
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    await interaction.reply({
      content: "Select the match format for this tournament:",
      components: [row],
      ephemeral: true,
    });
  }
}

export class MultiTeamSelectSubmit extends IdentityInteraction<"string_select"> {
  type = "string_select" as const;
  id = "multi_team_select";

  async execute(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const tournamentId = parseIdFromString(interaction.customId);
    if (!tournamentId) {
      await interaction.editReply({ content: "Invalid tournament ID." });
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      await interaction.editReply({ content: "Tournament not found." });
      return;
    }

    if (tournament.stage !== "SETUP") {
      await interaction.editReply({
        content: "Cannot change match format after registration has started.",
      });
      return;
    }

    const selectedValue = interaction.values[0];
    if (!selectedValue) {
      await interaction.editReply({ content: "No format selected." });
      return;
    }

    const isMultiTeam = selectedValue === "true";

    try {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { isMultiTeam },
      });

      await this.client.tournamentService.updateTournamentConfigMessage(
        tournament
      );

      const formatName = isMultiTeam
        ? "Multi-Team (Battle Royale)"
        : "Standard (1v1)";

      await interaction.editReply({
        content: `Match format changed to **${formatName}**!`,
      });

      // Update the original message to remove the select menu
      if (interaction.message) {
        await interaction.message.edit({
          content: `Match format: **${formatName}**`,
          components: [],
        });
      }
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({ content: error.message });
      } else {
        throw error;
      }
    }
  }
}

export default ShowMultiTeamSelect;
