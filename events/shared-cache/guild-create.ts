import { Event } from "@/base/classes/event";
import { Guild } from "discord.js";
import { redis } from "@/lib/redis";

import {
  serializeChannel,
  serializeGuild,
  serializeRole,
} from "@/lib/serializers";

import SuperJSON from "superjson";

export default class CacheGuilds extends Event<"guildCreate"> {
  public event = "guildCreate" as const;
  async execute(guild: Guild) {
    const channels = guild.channels.cache.values();
    const roles = guild.roles.cache.values();
    redis.set(`guild:${guild.id}`, SuperJSON.stringify(serializeGuild(guild)));
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
}
