import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";

const TeamConfigSchema = z.object({
  maxTeams: z.coerce.number().min(2).max(999),
  minPlayersPerTeam: z.coerce.number().min(1).max(99),
  maxPlayersPerTeam: z.coerce.number().min(1).max(99),
  maxSubstitutePerTeam: z.coerce.number().min(0).max(99).default(0),
});

export default class TeamConfigSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("team_config_submit")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) return;

    const rawBody = {
      maxTeams: interaction.fields.getTextInputValue("maxTeams"),
      minPlayersPerTeam:
        interaction.fields.getTextInputValue("minPlayersPerTeam"),
      maxPlayersPerTeam:
        interaction.fields.getTextInputValue("maxPlayersPerTeam"),
      maxSubstitutePerTeam: interaction.fields.getTextInputValue(
        "maxSubstitutePerTeam",
      ),
    };

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const parsed = TeamConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const data = parsed.data;

    if (data.minPlayersPerTeam > data.maxPlayersPerTeam) {
      await interaction.editReply({
        content: `Minimum players per team cannot be greater than maximum players per team.`,
      });
      return;
    }

    const scrim = await prisma.scrim.update({
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
    await interaction.editReply({
      content: `Team configuration updated successfully!`,
    });
    await this.client.scrimService.updateScrimConfigMessage(scrim);
  }
}
