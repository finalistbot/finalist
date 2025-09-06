import { Event } from "@/base/classes/event";
import { redis } from "@/lib/redis";
import { Channel } from "discord.js";

export default class ChannelCreate extends Event<"channelDelete"> {
  public event = "channelDelete" as const;
  async execute(channel: Channel) {
    if (channel.isDMBased()) return;

    await redis.hdel(`guild:${channel.guild.id}:channels`, channel.id);
  }
}
