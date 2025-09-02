import { Event } from "@/base/classes/event";
import { registerSlashCommands } from "@/services/slash-commands";
import { Message } from "discord.js";

export default class SyncCommandMessageHandler extends Event<"messageCreate"> {
  public event = "messageCreate" as const;
  async execute(message: Message) {
    if (message.content.startsWith(`<@${this.client.user?.id}> sync`)) {
      await registerSlashCommands(this.client);
      await message.reply(
        `Slash commands have been synchronized. Registered commands may take up to an hour to appear.`,
      );
    }
  }
}
