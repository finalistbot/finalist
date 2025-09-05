import { Interaction } from "discord.js";

export type CommandCheck = (
  interaction: Interaction,
) => Promise<boolean> | boolean;
