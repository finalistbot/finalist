import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";

export default class SubmitDisbandTeamSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "submit_disband_team_selection") return;
    if (!interaction.inGuild()) return;
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.values[0]!);

    const team = await this.client.teamManageService.disbandTeam(
      interaction.guild,
      teamId,
      interaction.user.id,
    );

    await interaction.editReply({
      content: `The team **${team.name}** has been disbanded.`,
      embeds: [],
      components: [],
    });
  }
}
