import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../base/classes/command";

export default class PingCommand implements Command {
  data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Pong!");
  }
}
