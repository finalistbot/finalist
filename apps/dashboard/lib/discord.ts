import { REST } from "@discordjs/rest";

import { config } from "@/config";

export const discordRest = new REST({ version: "10" }).setToken(
  config.BOT_TOKEN
);
