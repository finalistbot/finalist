import { GatewayIntentBits } from "discord.js";
import { BracketClient } from "./base/classes/client";

export const client = new BracketClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
