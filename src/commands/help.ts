import { Command } from "@/base/classes/command";
import { BRAND_COLOR } from "@/lib/constants";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export default class HelpCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get a list of available commands.");
  async execute(interaction: ChatInputCommandInteraction) {
    const commands = this.client.commands
      .filter((cmd) => !cmd.developerOnly)
      .map((cmd) => `> \`/${cmd.data.name}\` • ${cmd.data.description}`)
      .join("\n");
    const embed = new EmbedBuilder()
      .setTitle("Help")
      .setDescription(commands)
      .setColor(BRAND_COLOR);
    // TODO: Add dropdown menu for categories
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/yCdASUuQ"),
    );
    await interaction.reply({
      embeds: [embed],
      components: [buttonRow],
    });
  }
}
