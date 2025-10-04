import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";

export default class ShowManageTeamEmbed extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "show_manage_team_options") return;

    const teamId = parseInt(interaction.values[0]!);
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setTitle("Manage Teams")
      .setDescription("Click the button below to manage your teams.")
      .setColor(BRAND_COLOR);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`show_member_to_kick_selection:${teamId}`)
        .setLabel("Kick Member")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`show_team_info:${teamId}`)
        .setLabel("View Team")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel("Leave Team")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`submit_team_leave_selection:${teamId}`),
      new ButtonBuilder()
        .setCustomId(`submit_disband_team_selection:${teamId}`)
        .setLabel("Disband Team")
        .setStyle(ButtonStyle.Danger)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
