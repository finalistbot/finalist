import { Interaction } from "discord.js";
import { Event } from "../base/classes/event";

export default class CommandHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  public async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = this.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      this.client.emit("commandError", interaction, error, command.data.name);
    }
  }
}
