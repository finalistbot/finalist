import { ChatInputCommandInteraction } from "discord.js";

export type CommandCheck = (
  interaction: ChatInputCommandInteraction,
) => Promise<boolean> | boolean;
