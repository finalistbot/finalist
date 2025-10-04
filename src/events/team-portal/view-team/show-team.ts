import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import teamDetailsEmbed from "@/ui/embeds/team-details";

export default class ShowTeam extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("show_team_info:")) return;
    await interaction.deferUpdate();
    const teamId = parseInt(interaction.customId.split(":")[1]!);
    const team = await prisma.team.findUnique({
      where: { id: teamId, guildId: interaction.guildId! },
      include: { teamMembers: true },
    });
    if (!team) {
      await interaction.editReply({ content: "Team not found." });
      return;
    }
    const embed = await teamDetailsEmbed(team);

    await interaction.editReply({ embeds: [embed], components: [] });
  }
}
