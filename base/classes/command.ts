import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { BracketClient } from "./client";
import { CommandCheck } from "./check";
import { CheckFailure } from "./error";

export abstract class Command {
  constructor(protected readonly client: BracketClient) {}
  abstract data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  developerOnly = false;
  checks?: CommandCheck[];
  abstract execute(interaction: ChatInputCommandInteraction): Promise<unknown>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;
  async executeWithChecks(interaction: ChatInputCommandInteraction) {
    if (this.checks) {
      for (const check of this.checks) {
        let result = check(interaction);
        if (result instanceof Promise) {
          result = await result;
        }
        if (!result) {
          throw new CheckFailure("A check failed for this command.");
        }
      }
    }
    return await this.execute(interaction);
  }
}
