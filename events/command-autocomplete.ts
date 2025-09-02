import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import { Events } from "discord.js";
export default class CommandAutocomplete extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.InteractionCreate, once: false });
  }

  public async execute(interaction: any) {
    if (!interaction.isAutocomplete()) return;

    const command = this.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
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
