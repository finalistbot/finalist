import { Command } from "@/base/classes/command";
import { CommandInfo } from "@/types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

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
    await interaction.reply({ content: `Pong! 🏓` });
  }
}
