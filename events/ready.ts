import { Events } from "discord.js";
import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import config from "@/config";
import { Routes } from "discord.js";
import { rest } from "@/lib/discord-rest";
import logger from "@/lib/logger";

export default class Ready extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.ClientReady, once: true });
  }

  public async execute() {
    logger.info(`Logged in as ${this.client.user?.tag}!`);
    return;
    const globalCommands = this.client.commands.filter(
      (cmd) => !cmd.developerOnly,
    );
    const devCommands = this.client.commands.filter((cmd) => cmd.developerOnly);
    await rest.put(Routes.applicationCommands(this.client.user!.id), {
      body: globalCommands.map((command) => command.data.toJSON()),
    });
    if (config.DEVELOPER_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          this.client.user!.id,
          config.DEVELOPER_GUILD_ID,
        ),
        { body: devCommands.map((command) => command.data.toJSON()) },
      );
    }
    logger.info(
      `Registered ${globalCommands.size} global commands and ${devCommands.size} developer commands.`,
    );
  }
}
