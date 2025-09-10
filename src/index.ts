import path from "path";
import { client } from "./client";
import { Event } from "./base/classes/event";
import config from "./config";
import logger from "./lib/logger";
import { getHandlerFiles } from "./lib/fs";

function registerEvent(filePath: string) {
  import(path.resolve(filePath)).then((mod) => {
    try {
      const Handler = mod.default?.default || mod.default;
      const event: Event<any> = new Handler(client);
      client.on(event.event.toString(), async (...args) => {
        try {
          await event.execute(...args);
        } catch (err) {
          logger.error(
            `Error executing event ${event.event.toString()}: ${err}`,
          );
        }
      });
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
  import(path.resolve(filePath)).then((mod) => {
    try {
      const Command = mod.default?.default || mod.default;
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

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

client.login(config.BOT_TOKEN);
