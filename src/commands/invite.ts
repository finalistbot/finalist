import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BRAND_COLOR, botInviteLink, supportServerLink } from "@/lib/constants";
import { CommandInfo } from "@/types/command";

export default class InviteCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the bot invite link.");
  info: CommandInfo = {
    name: "invite",
    category: "General",
    description: "Get the bot invite link.",
    usageExamples: ["/invite"],
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle("🔗 Invite Me!")
      .setDescription("Manage scrims in your Discord server with Finalist Bot!")
      .setFooter({ text: "Click the button below to get started." })
      .setColor(BRAND_COLOR);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("➕ Invite Me")
        .setStyle(ButtonStyle.Link)
        .setURL(botInviteLink),
      new ButtonBuilder()
        .setLabel("💬 Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL(supportServerLink)
    );
    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }
}
