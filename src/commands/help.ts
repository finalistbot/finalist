import { Command } from "@/base/classes/command";
import { BRAND_COLOR } from "@/lib/constants";
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

const Categories = ["Admin", "Team", "Scrim"];

const description = [
  "## Bot Help",
  "Invite finalist to your server and join our community server! You can vote every 12 hours for finalist! ❤️",
  "### Categories",
  Categories.map((cat) => `• ${cat}`).join("\n"),
].join("\n");
export default class HelpCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get a list of available commands.");
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor(BRAND_COLOR);
    // FIXME:  Error executing event interactionCreate: TypeError: component.toJSON is not a function

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_category_select")
      .setPlaceholder("Select a category")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Admin").setValue("admin"),
        new StringSelectMenuOptionBuilder().setLabel("Team").setValue("team"),
        new StringSelectMenuOptionBuilder().setLabel("Scrim").setValue("scrim")
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }
}
