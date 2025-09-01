import { BracketClient } from "./base/classes/client";

export const client = new BracketClient({
  intents: ["Guilds", "GuildMessages"],
});
