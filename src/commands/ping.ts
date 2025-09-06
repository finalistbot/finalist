import { Command } from "@/base/classes/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class PingCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

  async execute(interaction: ChatInputCommandInteraction) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! Latency is ${latency}ms.`);
  }
}
