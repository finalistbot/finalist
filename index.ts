import { BracketClient } from "./base/classes/client";
import { Event } from "./base/classes/event";
import config from "./config";
import fs from "fs";

const client = new BracketClient({
  intents: ["Guilds", "GuildMessages"],
});

function registerHandlers() {
  fs.readdirSync("./events").forEach(async (file) => {
    if (!file.endsWith(".ts")) return;
    const { default: Handler } = await import(`./events/${file}`);
    const handler = new Handler(client) as Event;
    client.on(handler.event.toString(), (...args) => handler.execute(...args));
  });
}

registerHandlers();

client.login(config.BOT_TOKEN);
