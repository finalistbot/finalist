import { Event } from "@/base/classes/event";
import { registerSlashCommands } from "@/services/slash-commands";
import { Message } from "discord.js";

export default class SyncCommandMessageHandler extends Event<"messageCreate"> {
  public event = "messageCreate" as const;
  async execute(message: Message) {
    if (message.author.id !== this.client.application?.owner?.id) return;
    let command = message.content.trim().toLowerCase();
    command = command.replace(`<@${this.client.user?.id}>`, "").trim();
    switch (command) {
      case "sync slash commands":
        await this.syncSlashCommands(message);
        break;
      default:
        break;
    }
  }

  async syncSlashCommands(message: Message) {
    await registerSlashCommands(this.client);
    await message.reply(
      `Slash commands have been synchronized. Registered commands may take up to an hour to appear.`,
    );
  }
}
