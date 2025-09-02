import { Events } from "discord.js";
import { BracketClient } from "../base/classes/client";
import { Event } from "../base/classes/event";
import fs from "fs";
import { Command } from "../base/classes/command";
import { REST, Routes } from "discord.js";

import config from "../config";
const rest = new REST({ version: "10" }).setToken(config.BOT_TOKEN);

export default class Ready extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.ClientReady, once: true });
  }

  public async execute() {
    console.log(`Ready! Logged in as ${this.client.user!.tag}`);
    return;
    await rest.put(Routes.applicationCommands(this.client.user!.id), {
      body: this.client.commands.map((command) => command.data.toJSON()),
    });
    console.log("Successfully registered application commands.");
  }
}
