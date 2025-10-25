import { ButtonInteraction } from "discord.js";

import { BracketError } from "@/base/classes/error";
import { IdentityInteraction } from "@/base/classes/identity-interaction";

export default class TeamLeaveSelection extends IdentityInteraction<"button"> {
  id = "team_leave_selection";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.customId.split(":")[1]!);
    let team;
    try {
      team = await this.client.teamManageService.leaveTeam(
        interaction.guild!,
        teamId,
        interaction.user
      );
    } catch (e) {
      if (e instanceof BracketError) {
        await interaction.editReply({
          content: e.message,
          embeds: [],
          components: [],
        });
        return;
      }
      throw e;
    }
    await interaction.editReply({
      content: `You have successfully ${team.name} left the team.`,
      embeds: [],
      components: [],
    });
  }
}
