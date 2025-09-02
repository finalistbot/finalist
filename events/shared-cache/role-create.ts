import { Event } from "@/base/classes/event";
import { redis } from "@/lib/redis";
import { serializeRole } from "@/lib/serializers";
import { Role } from "discord.js";
import SuperJSON from "superjson";

export default class RoleCreate extends Event<"roleCreate"> {
  public event = "roleCreate" as const;
  async execute(role: Role) {
    await redis.hset(
      `guild:${role.guild.id}:roles`,
      role.id,
      SuperJSON.stringify(serializeRole(role)),
    );
  }
}
