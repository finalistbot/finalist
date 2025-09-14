import { Client, ClientOptions } from "discord.js";

export class BracketClient extends Client {
  public ownerIds: Set<string>;

  constructor(options: ClientOptions, extra?: { ownerIds?: string[] }) {
    super(options);
    this.ownerIds = new Set(extra?.ownerIds);
  }

  isOwner(userId: string): boolean {
    if (this.application?.owner?.id === userId) return true;
    return this.ownerIds.has(userId);
  }
}
