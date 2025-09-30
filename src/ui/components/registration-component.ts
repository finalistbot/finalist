import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function prepareRegistrationComponents() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Create Team")
      .setStyle(ButtonStyle.Primary)
      .setCustomId("create_team")
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId("view_team")
      .setLabel("Register Team")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🛡️")
  );
  return [row];
}
