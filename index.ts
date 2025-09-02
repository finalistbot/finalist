import path from "path";
import { client } from "./client";
import { Event } from "./base/classes/event";
import config from "./config";
import fs from "fs";

function registerHandlers(dir = "./events") {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      registerHandlers(filePath);
    } else if (file.endsWith(".ts")) {
      import(path.resolve(filePath)).then(({ default: Handler }) => {
        const event: Event = new Handler(client);
        client.on(event.event.toString(), (...args) => event.execute(...args));
      });
    }
  }
}

function registerCommands(dir = "./commands") {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      registerCommands(filePath);
    } else if (file.endsWith(".ts")) {
      import(path.resolve(filePath)).then(({ default: Command }) => {
        try {
          const command = new Command(client);
          client.commands.set(command.data.name, command);
        } catch (error) {
          console.error(`Error loading command at ${filePath}:`, error);
          return;
        }
      });
    }
  }
}

registerHandlers();
registerCommands();

client.login(config.BOT_TOKEN);
