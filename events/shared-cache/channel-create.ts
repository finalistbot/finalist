import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import { redis } from "@/lib/redis";
import { serializeChannel } from "@/lib/serializers";
import { Channel, Events } from "discord.js";
import SuperJSON from "superjson";

export default class ChannelCreate extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.ChannelCreate, once: false });
  }
  async execute(channel: Channel) {
    if (channel.isDMBased()) return;

    await redis.hset(
      `guild:${channel.guild.id}:channels`,
      channel.id,
      SuperJSON.stringify(serializeChannel(channel)),
    );
  }
}
