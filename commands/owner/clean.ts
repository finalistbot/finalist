import { Command } from "@/base/classes/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class CleanTestServer extends Command {
  developerOnly = true;
  data = new SlashCommandBuilder()
    .setName("cleantestserver")
    .setDescription("Clean up the test server");
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Cleaning up...");
    for (const channel of interaction.guild!.channels.cache.values()) {
      await channel.delete();
    }
    for (const role of interaction.guild!.roles.cache.values()) {
      if (
        (role.editable && role.id !== interaction.guild!.id) ||
        role.name != "Developer"
      ) {
        try {
          await role.delete();
        } catch (e) {
          console.log(`Failed to delete role ${role.name}: ${e}`);
        }
      }
    }
  }
}
