import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { Interaction } from "discord.js";
export default class BanTeamModalSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("ban_team_modal:")) return;
    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) return;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { TeamMember: true, scrim: true },
    });
    if (!team) {
      await interaction.reply({
        content: "Team not found.",
        flags: "Ephemeral",
      });
      return;
    }
    if (team.banned) {
      await interaction.reply({
        content: "Team is already banned.",
        flags: "Ephemeral",
      });
      return;
    }
    const banReason = interaction.fields.getTextInputValue("ban_reason");
    await prisma.team.update({
      where: { id: teamId },
      data: { banned: true, banReason: banReason || null },
    });
    // Delete slot if exists
    await prisma.assignedSlot.deleteMany({
      where: { teamId: team.id, scrimId: team.scrimId },
    });
    await interaction.reply({
      content: `Team **${team.name}** has been banned.${banReason ? ` Reason: ${banReason}` : ""}\n\nThis ban is only for this scrim. To permanently ban a team, please use \`/ban\`.`,
      flags: "Ephemeral",
    });

    try {
      if (team.messageId) {
        const channel = this.client.channels.cache.get(
          team.scrim.participantsChannelId,
        );
        if (!channel || !channel.isTextBased() || !team.messageId) return;
        await channel.messages.delete(team.messageId);
        await prisma.team.update({
          where: { id: teamId },
          data: { messageId: null },
        });
      }
    } catch (err) {
      console.error("Failed to delete team message:", err);
    }
  }
}
