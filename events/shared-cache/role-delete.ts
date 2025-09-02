import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import { Events, Role } from "discord.js";
import { redis } from "@/lib/redis";

export default class RoleDelete extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.GuildRoleDelete, once: false });
  }
  async execute(role: Role) {
    await redis.hdel(`guild:${role.guild.id}:roles`, role.id);
  }
}
