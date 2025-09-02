import { ClientEvents } from "discord.js";
import { BracketClient } from "./client";

interface CustomEvents {
  scrimCreate: [scrimId: number, hostId: string];
  scrimEnd: [scrimId: number];
}
type BracketClientEvents = ClientEvents & CustomEvents;

export abstract class Event<K extends keyof BracketClientEvents> {
  public abstract event: K;
  public once: boolean = false;
  constructor(protected client: BracketClient) {}
  abstract execute(...args: BracketClientEvents[K]): Promise<void>;
}
