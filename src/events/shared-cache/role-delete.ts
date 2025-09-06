import { Event } from "@/base/classes/event";
import { Role } from "discord.js";
import { redis } from "@/lib/redis";

export default class RoleDelete extends Event<"roleDelete"> {
  public event = "roleDelete" as const;
  async execute(role: Role) {
    await redis.hdel(`guild:${role.guild.id}:roles`, role.id);
  }
}
