import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function prepareRegisterTeamComponents() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Create Team")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`show_create_team_modal`),
    new ButtonBuilder()
      .setLabel("Join Team")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`show_join_team_model`)
  );
  return [row];
}
