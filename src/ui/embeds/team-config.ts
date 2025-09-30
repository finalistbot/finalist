import { EmbedBuilder } from "discord.js";

export function TeamConfigEmbed() {
  const embed = new EmbedBuilder()
    .setTitle("Team Configuration")
    .setDescription("This is a team configuration embed.");

  return embed;
}
