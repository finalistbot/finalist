import { BracketError } from "@/base/classes/error";
import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { ButtonInteraction, Interaction } from "discord.js";

export default class DisbandTeamSelection extends IdentityInteraction<"button"> {
  id = "disband_team_confirmation";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.customId.split(":")[1]!);

    let team;
    try {
      team = await this.client.teamManageService.disbandTeam(
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
      content: `The team **${team.name}** has been disbanded.`,
      embeds: [],
      components: [],
    });
  }
}
