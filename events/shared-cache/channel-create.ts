import { Event } from "@/base/classes/event";
import { redis } from "@/lib/redis";
import { serializeChannel } from "@/lib/serializers";
import { Channel } from "discord.js";
import SuperJSON from "superjson";

export default class ChannelCreate extends Event<"channelCreate"> {
  public event = "channelCreate" as const;
  async execute(channel: Channel) {
    if (channel.isDMBased()) return;

    await redis.hset(
      `guild:${channel.guild.id}:channels`,
      channel.id,
      SuperJSON.stringify(serializeChannel(channel)),
    );
  }
}
