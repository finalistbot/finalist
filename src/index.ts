import path from "path";
import { client } from "./client";
import { Event } from "./base/classes/event";
import config from "./config";
import logger from "./lib/logger";
import { getHandlerFiles } from "./lib/fs";

function registerEvent(filePath: string) {
  import(path.resolve(filePath)).then(({ default: Handler }) => {
    try {
      const event: Event<any> = new Handler(client);
      client.on(event.event.toString(), (...args) => event.execute(...args));
      logger.info(`Loaded event ${event.constructor.name}`);
    } catch (error) {
      logger.error(`Error loading event at ${filePath}: ${error}`);
      return;
    }
  });
}

function registerEvents() {
  const handlerFilesPath = path.join(__dirname, "events");
  const handlerFiles = getHandlerFiles(handlerFilesPath);
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
  const handlerFilesPath = path.join(__dirname, "commands");
  const handlerFiles = getHandlerFiles(handlerFilesPath);
  handlerFiles.forEach((file) => registerCommand(file));
}

registerEvents();
registerCommands();

client.login(config.BOT_TOKEN);
