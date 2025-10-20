import { ChatInputCommandInteraction, ClientEvents } from 'discord.js'
import { BracketClient } from './client'

interface BracketEvents {
  commandError: [
    interaction: ChatInputCommandInteraction,
    error: Error,
    commandName: string,
  ]
}
type BracketClientEvents = ClientEvents & BracketEvents

export abstract class Event<K extends keyof BracketClientEvents> {
  public abstract event: K
  public once: boolean = false
  constructor(protected client: BracketClient) {}
  abstract execute(...args: BracketClientEvents[K]): Promise<void>
}
