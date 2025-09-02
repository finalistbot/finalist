import { BracketClient } from "@/base/classes/client";
import config from "@/config";
import { rest } from "@/lib/discord-rest";
import logger from "@/lib/logger";
import { Routes } from "discord.js";

export async function registerSlashCommands(client: BracketClient) {
  const globalCommands = client.commands.filter((cmd) => !cmd.developerOnly);
  const devCommands = client.commands.filter((cmd) => cmd.developerOnly);
  await rest.put(Routes.applicationCommands(client.user!.id), {
    body: globalCommands.map((command) => command.data.toJSON()),
  });
  if (config.DEVELOPER_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        client.user!.id,
        config.DEVELOPER_GUILD_ID,
      ),
      { body: devCommands.map((command) => command.data.toJSON()) },
    );
  }
  logger.info(
    `Registered ${globalCommands.size} global commands and ${devCommands.size} developer commands.`,
  );

  return { globalCommands, devCommands };
}
