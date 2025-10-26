import { Interaction } from "discord.js";

import { CommandRegistory } from "@/base/classes/command";
import { CheckFailure } from "@/base/classes/error";
import { Event } from "@/base/classes/event";

export default class CommandHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  public async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.bot) return;

    const command = CommandRegistory.getCommand(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }
    try {
      if (command.checks) {
        for (const check of command.checks) {
          let result = check(interaction);
          if (result instanceof Promise) {
            result = await result;
          }
          if (!result) {
            throw new CheckFailure("A check failed for this command.");
          }
        }
      }
      await command.execute(interaction);
    } catch (error) {
      this.client.emit("commandError", interaction, error, command.data.name);
    }
  }
}
