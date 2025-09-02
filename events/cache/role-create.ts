import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import { redis } from "@/lib/redis";
import { serializeRole } from "@/lib/serializers";
import { Events, Role } from "discord.js";
import SuperJSON from "superjson";

export default class RoleCreate extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.GuildRoleCreate, once: false });
  }
  async execute(role: Role) {
    await redis.hset(
      `guild:${role.guild.id}:roles`,
      role.id,
      SuperJSON.stringify(serializeRole(role)),
    );
  }
}
