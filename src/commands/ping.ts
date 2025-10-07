import { Command } from "@/base/classes/command";
import { registerInteractionHandler } from "@/events/interaction-handler";
import { CommandInfo } from "@/types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

registerInteractionHandler("button", "test_button", async (interaction) => {
  if (!interaction.isButton()) return;
  await interaction.update({
    content: "Test button clicked!",
    components: [],
  });
});
export default class PingCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

  info: CommandInfo = {
    name: "ping",
    category: "General",
    description: "Replies with Pong!",
    usageExamples: ["/ping"],
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("test_button")
        .setLabel("Test Button")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ content: `Pong! 🏓`, components: [row] });
  }
}
