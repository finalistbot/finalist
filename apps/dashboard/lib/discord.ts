import { config } from "@/config";
import { REST } from "@discordjs/rest";

export const discordRest = new REST({ version: "10" }).setToken(
  config.BOT_TOKEN,
);
