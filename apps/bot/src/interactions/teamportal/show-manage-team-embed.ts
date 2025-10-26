import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalSubmitInteraction,
} from "discord.js";

import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { BRAND_COLOR } from "@/lib/constants";

export default class ShowManageTeamEmbed extends IdentityInteraction<"modal"> {
  id = "team_select_modal";
  type = "modal" as const;
  async execute(interaction: ModalSubmitInteraction) {
    const teamId = interaction.fields.getStringSelectValues("team")[0];
    await interaction.deferReply({ flags: ["Ephemeral"] });

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
        .setCustomId(`disband_team_confirmation:${teamId}`)
        .setLabel("Disband Team")
        .setStyle(ButtonStyle.Danger)
    );
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  }
}
