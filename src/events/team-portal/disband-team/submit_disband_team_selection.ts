import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { Interaction } from "discord.js";

export default class SubmitDisbandTeamSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "submit_disband_team_selection") return;
    if (!interaction.inGuild()) return;
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.values[0]!);

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        guildId: interaction.guildId,
        teamMembers: { some: { userId: interaction.user.id, role: "CAPTAIN" } },
      },
      include: { teamMembers: true },
    });
    if (!team) {
      await interaction.editReply({
        content:
          "The selected team does not exist or you are not a captain of the team.",
        embeds: [],
        components: [],
      });
      return;
    }
    if (team.banned) {
      await interaction.editReply({
        content: "You cannot disband a team that is banned.",
        embeds: [],
        components: [],
      });
      return;
    }
    const registeredIn = await prisma.registeredTeam.count({
      where: { teamId: team.id },
    });
    if (registeredIn > 0) {
      await interaction.editReply({
        content:
          "You cannot disband a team that is registered for a scrim. Please contact staff for assistance.",
        embeds: [],
        components: [],
      });
      return;
    }

    await prisma.team.delete({
      where: { id: team.id },
    });

    await interaction.editReply({
      content: `The team **${team.name}** has been disbanded.`,
      embeds: [],
      components: [],
    });
  }
}
