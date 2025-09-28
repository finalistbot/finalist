import { BRAND_COLOR } from "@/lib/constants";
import { EmbedBuilder } from "discord.js";

export function registerEmbed() {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🛡️ Team Registration")
    .setDescription(
      "To register your team for a scrim, please use the `/register` command followed by your team name and the scrim ID."
    );
  return embed;
}
