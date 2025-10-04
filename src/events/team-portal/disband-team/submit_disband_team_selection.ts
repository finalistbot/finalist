import { BracketError } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";

export default class SubmitDisbandTeamSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("submit_disband_team_selection:"))
      return;
    if (!interaction.inGuild()) return;
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.customId.split(":")[1]!);

    let team;
    try {
      team = await this.client.teamManageService.disbandTeam(
        interaction.guild,
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
