import { Client, ClientOptions, Collection } from "discord.js";
import { Command } from "./command";

export class BracketClient extends Client {
  public commands: Collection<string, Command>;
  public ownerIds: string[];

  constructor(options: ClientOptions, extra?: { ownerIds?: string[] }) {
    super(options);
    this.commands = new Collection();
    this.ownerIds = extra?.ownerIds || [];
  }

  isOwner(userId: string): boolean {
    if (this.application?.owner?.id === userId) return true;
    return this.ownerIds.includes(userId);
  }
}
