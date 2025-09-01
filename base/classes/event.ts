import { Events } from "discord.js";
import { BracketClient } from "./client";

export abstract class Event {
  public event: Events;
  public once: boolean;
  protected client: BracketClient;
  abstract execute(...args: any[]): Promise<void>;
  constructor(
    client: BracketClient,
    { event, once }: { event: Events; once: boolean },
  ) {
    this.client = client;
    this.event = event;
    this.once = once;
  }
}
