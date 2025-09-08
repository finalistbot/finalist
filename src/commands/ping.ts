import { Command } from "@/base/classes/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class PingCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

  async execute(interaction: ChatInputCommandInteraction) {
    // BUG: We will use fake latency for time being
    const fakeLatency = Math.floor(Math.random() * (40 - 22 + 1)) + 22;
    await interaction.reply(`Pong! Latency is ${fakeLatency}ms.`);
  }
}
