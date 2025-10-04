import { BracketError } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";
import th from "zod/v4/locales/th.js";

export default class SubmitTeamLeaveSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "submit_team_leave_selection") return;

    await interaction.deferUpdate();

    const teamId = parseInt(interaction.values[0]!);
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
      content: ``,
      embeds: [],
      components: [],
    });
  }
}
