import { CommandError } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { ChatInputCommandInteraction, CacheType } from "discord.js";

export default class CommandErrorHandler extends Event<"commandError"> {
  public event: "commandError" = "commandError";
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    error: Error,
    commandName: string,
  ): Promise<void> {
    if (!(error instanceof CommandError)) {
      console.error(`Unexpected error in command ${commandName}:`, error);
      return;
    }
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: error.message,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: error.message,
        ephemeral: true,
      });
    }
    console.error(`Error executing command ${commandName}:`, error);
  }
}
