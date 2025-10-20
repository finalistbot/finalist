import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { BracketError } from "@/base/classes/error";
import { prisma } from "@/lib/prisma";
import { ButtonInteraction } from "discord.js";
import { parseIdFromString } from "@/lib/utils";

export default class GenerateTournamentBracket extends IdentityInteraction<"button"> {
  type = "button" as const;
  id = "generate_tournament_bracket";

  async execute(interaction: ButtonInteraction) {
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
      await interaction.editReply({
        content: "Tournament not found.",
      });
      return;
    }

    try {
      await this.client.tournamentService.generateBracket(tournament);

      // Get match count
      const matchCount = await prisma.match.count({
        where: { tournamentId: tournament.id },
      });

      await interaction.editReply({
        content: `Bracket generated successfully! ${matchCount} matches created. Check <#${tournament.bracketsChannelId}> for details.`,
      });

      // Send bracket info to brackets channel
      const bracketsChannel = await this.client.channels.fetch(
        tournament.bracketsChannelId
      );

      if (
        bracketsChannel &&
        bracketsChannel.isTextBased() &&
        !bracketsChannel.isDMBased()
      ) {
        const teams = await prisma.tournamentTeam.count({
          where: { tournamentId: tournament.id },
        });

        await bracketsChannel.send({
          content: `**${tournament.name}** bracket has been generated!\n\n📊 **Stats:**\n- Teams: ${teams}\n- Matches: ${matchCount}\n- Format: ${tournament.tournamentType.replace(/_/g, " ")}\n\nUse \`/report-score\` to report match results.`,
        });
      }
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        throw error;
      }
    }
  }
}
