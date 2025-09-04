import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";
export default class CommandAutocomplete extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  public async execute(interaction: Interaction) {
    if (!interaction.isAutocomplete()) return;

    const command = this.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    try {
      if (!command.autocomplete) return;
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);
    }
  }
}
