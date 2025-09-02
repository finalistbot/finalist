import path from "path";
import { client } from "./client";
import { Event } from "./base/classes/event";
import config from "./config";
import fs from "fs";
import logger from "./lib/logger";
import { getHandlerFiles } from "./lib/fs";

function registerEvent(filePath: string) {
  import(path.resolve(filePath)).then(({ default: Handler }) => {
    try {
      const event: Event = new Handler(client);
      client.on(event.event.toString(), (...args) => event.execute(...args));
      logger.info(`Loaded event ${event.constructor.name}`);
    } catch (error) {
      logger.error(`Error loading event at ${filePath}: ${error}`);
      return;
    }
  });
}

function registerEvents() {
  const handlerFiles = getHandlerFiles("./events");
  handlerFiles.forEach((file) => registerEvent(file));
}

function registerCommand(filePath: string) {
  import(path.resolve(filePath)).then(({ default: Command }) => {
    try {
      const command = new Command(client);
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command ${command.data.name}`);
    } catch (error) {
      logger.error(`Error loading command at ${filePath}: ${error}`);
      return;
    }
  });
}

function registerCommands() {
  const handlerFiles = getHandlerFiles("./commands");
  handlerFiles.forEach((file) => registerCommand(file));
}

registerEvents();
registerCommands();

client.login(config.BOT_TOKEN);
