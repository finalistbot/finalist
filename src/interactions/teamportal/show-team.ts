import { ButtonInteraction } from "discord.js";

import { prisma } from "@/lib/prisma";
import teamDetailsEmbed from "@/ui/embeds/team-details";
import { IdentityInteraction } from "@/base/classes/identity-interaction";

export default class ShowTeamInfo extends IdentityInteraction<"button"> {
  id = "show_team_info";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
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
