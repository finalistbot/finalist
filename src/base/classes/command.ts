import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { BracketClient } from "./client";
import { CommandCheck } from "./check";
import { CommandCategory, CommandInfo } from "@/types/command";

export abstract class Command {
  constructor(protected readonly client: BracketClient) {}
  info?: CommandInfo;
  abstract data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  developerOnly = false;
  checks?: CommandCheck[];
  load: boolean = true;
  abstract execute(interaction: ChatInputCommandInteraction): Promise<unknown>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;
}

export class CommandRegistory {
  private static commands = new Map<string, Command>();
  private static categories = new Map<string, CommandCategory>();

  static registerCommand(command: Command) {
    this.commands.set(command.data.name, command);

    if (command.info) {
      const category = command.info.category || "General";
      if (!this.categories.has(category)) {
        this.categories.set(category, {
          name: category,
          description: "Commands related to " + category.toLowerCase(),
        });
      }
    }
  }

  static registerCategory(category: CommandCategory) {
    this.categories.set(category.name, category);
  }

  static getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  static getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  static getCommandsByCategory(category: string): Command[] {
    return this.getAllCommands().filter(
      (cmd) => (cmd.info?.category || "General") === category,
    );
  }

  static getCategory(name: string): CommandCategory | undefined {
    return this.categories.get(name);
  }

  static getCategories(): Map<string, CommandCategory> {
    return this.categories;
  }

  static initializeCategories() {
    this.registerCategory({
      name: "General",
      description: "General commands",
      emoji: "📋",
    });
    this.registerCategory({
      name: "Esports",
      description: "Esports related commands",
      emoji: "🎮",
    });
  }
}
