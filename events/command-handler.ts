import { Events, Interaction } from "discord.js";
import { Event } from "../base/classes/event";
import { BracketClient } from "../base/classes/client";

export default class CommandHandler extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.InteractionCreate, once: false });
  }
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
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);
    }
  }
}
