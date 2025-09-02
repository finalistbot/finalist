import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import { Events } from "discord.js";
import { redis } from "@/lib/redis";

import {
  serializeChannel,
  serializeGuild,
  serializeRole,
} from "@/lib/serializers";

import SuperJSON from "superjson";
import logger from "@/lib/logger";

export default class CacheGuilds extends Event {
  constructor(client: BracketClient) {
    super(client, {
      event: Events.ClientReady,
      once: true,
    });
  }
  async execute() {
    const guilds = this.client.guilds.cache.values();
    for (const guild of guilds) {
      const channels = guild.channels.cache.values();
      const roles = guild.roles.cache.values();
      redis.set(
        `guild:${guild.id}`,
        SuperJSON.stringify(serializeGuild(guild)),
      );
      redis.hset(
        `guild:${guild.id}:channels`,
        Object.fromEntries(
          [...channels].map((channel) => [
            channel.id,
            SuperJSON.stringify(serializeChannel(channel)),
          ]),
        ),
      );
      redis.hset(
        `guild:${guild.id}:roles`,
        Object.fromEntries(
          [...roles].map((role) => [
            role.id,
            SuperJSON.stringify(serializeRole(role)),
          ]),
        ),
      );
    }
    logger.info("Cached guilds, channels, and roles to Redis.");
  }
}
