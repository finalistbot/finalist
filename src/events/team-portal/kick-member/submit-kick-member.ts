import { BracketError } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
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

    let team;
    try {
      team = await this.client.teamManageService.kickMember(
        interaction.guild!,
        interaction.user,
        teamId,
        memberToKick
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
    interaction.editReply({
      content: `Successfully kicked <@${memberToKick}> from the team ${team.name}.`,
      components: [],
      embeds: [],
    });
  }
}
