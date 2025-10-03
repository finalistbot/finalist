import {
  ActionRow,
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
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_manage_teams") return;

    await interaction.deferReply({ flags: ["Ephemeral"] });
    const embed = new EmbedBuilder()
      .setTitle("Manage Teams")
      .setDescription("Click the button below to manage your teams.")
      .setColor(BRAND_COLOR);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("show_kick_member_team_selection")
        .setLabel("Kick Member")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("show_view_team_selection")
        .setLabel("View Team")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("show_disband_team_selection")
        .setLabel("Disband Team")
        .setStyle(ButtonStyle.Danger)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
