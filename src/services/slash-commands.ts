import { Routes } from "discord.js";

import { BracketClient } from "@/base/classes/client";
import { CommandRegistory } from "@/base/classes/command";
import config from "@/config";
import { rest } from "@/lib/discord-rest";
import logger from "@/lib/logger";

export async function registerSlashCommands(client: BracketClient) {
  const globalCommands = CommandRegistory.getAllCommands().filter(
    (cmd) => !cmd.developerOnly
  );
  const devCommands = CommandRegistory.getAllCommands().filter(
    (cmd) => cmd.developerOnly
  );
  await rest.put(Routes.applicationCommands(client.user!.id), {
    body: globalCommands.map((command) => command.data.toJSON()),
  });
  if (config.DEVELOPER_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        client.user!.id,
        config.DEVELOPER_GUILD_ID
      ),
      { body: devCommands.map((command) => command.data.toJSON()) }
    );
  }
  logger.info(
    `Registered ${globalCommands.length} global commands and ${devCommands.length} developer commands.`
  );

  return { globalCommands, devCommands };
}
