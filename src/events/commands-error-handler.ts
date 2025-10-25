import { CacheType, ChatInputCommandInteraction } from "discord.js";

import { BracketError } from "@/base/classes/error";
import { Event } from "@/base/classes/event";

export default class CommandErrorHandler extends Event<"commandError"> {
  public event: "commandError" = "commandError";
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    error: Error,
    commandName: string
  ): Promise<void> {
    if (!(error instanceof BracketError)) {
      console.error(`Unexpected error in command ${commandName}:`, error);
      return;
    }
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: error.message,
          flags: ["Ephemeral"],
        });
      } else {
        await interaction.reply({
          content: error.message,
          flags: ["Ephemeral"],
        });
      }
    } catch (err) {
      console.error("Failed to send error message to user:", err);
    }
    console.error(`Error executing command ${commandName}:`, error);
  }
}
