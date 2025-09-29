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
    const team = await prisma.registeredTeam.findUnique({
      where: { id: teamId },
      include: { registeredTeamMembers: true },
    });
    if (!team) {
      await interaction.reply({
        content: "Team not found.",
        flags: "Ephemeral",
      });
      return;
    }
    const banReason = interaction.fields.getTextInputValue("ban_reason");
    await prisma.team.update({
      where: { id: teamId },
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
    await interaction.reply({
      content: `Team **${team.name}** has been banned.${banReason ? ` Reason: ${banReason}` : ""}\n\nThis ban is only for this scrim. To permanently ban a team, please use \`/ban\`.`,
      flags: "Ephemeral",
    });
  }
}
