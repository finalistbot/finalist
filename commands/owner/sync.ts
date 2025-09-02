import { Command } from "@/base/classes/command";
import { registerSlashCommands } from "@/services/slash-commands";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class SyncSlashCommands extends Command {
  data = new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Sync slash commands");
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const { globalCommands, devCommands } = await registerSlashCommands(
      this.client,
    );
    await interaction.reply({
      content: `Registered ${globalCommands.size} global commands and ${devCommands.size} developer commands.`,
      flags: "Ephemeral",
    });
  }
}
