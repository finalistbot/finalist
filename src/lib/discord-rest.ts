import { REST } from "discord.js";

import config from "@/config";

export const rest = new REST({ version: "10" }).setToken(config.BOT_TOKEN);
