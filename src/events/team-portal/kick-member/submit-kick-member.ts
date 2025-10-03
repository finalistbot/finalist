import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { Stage } from "@prisma/client";
import { Interaction } from "discord.js";

export default class SubmitKickMember extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("kick_member_selection:")) return;
    if (!interaction.inGuild()) return;
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.customId.split(":")[1]!);
    const memberToKick = interaction.values[0]!;
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: {
          some: { role: "CAPTAIN", userId: interaction.user.id },
        },
      },
    });
    if (!team) {
      await interaction.editReply({
        content:
          "You are not a captain of this team or the team does not exist in this server.",
        embeds: [],
        components: [],
      });
      return;
    }
    if (team.banned) {
      await interaction.editReply({
        content: "This team is banned and cannot kick members.",
        embeds: [],
        components: [],
      });
      return;
    }
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId: memberToKick },
    });
    if (!teamMember) {
      await interaction.editReply({
        content: "This user is not a member of the team.",
        embeds: [],
        components: [],
      });
      return;
    }
    if (teamMember.role === "CAPTAIN") {
      await interaction.editReply({
        content: "You cannot kick a captain from the team.",
        embeds: [],
        components: [],
      });
      return;
    }
    await prisma.teamMember.delete({
      where: { id: teamMember.id },
    });
    interaction.editReply({
      content: `Successfully kicked <@${memberToKick}> from the team ${team.name}.`,
      components: [],
      embeds: [],
    });
  }
}
