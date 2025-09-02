import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import { redis } from "@/lib/redis";
import { Channel, Events } from "discord.js";

export default class ChannelCreate extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.ChannelDelete, once: false });
  }
  async execute(channel: Channel) {
    if (channel.isDMBased()) return;

    await redis.hdel(`guild:${channel.guild.id}:channels`, channel.id);
  }
}
