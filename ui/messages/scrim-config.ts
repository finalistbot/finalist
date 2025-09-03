import { Scrim } from "@prisma/client";
import { Message, TextChannel } from "discord.js";
import { scrimConfigEmbed } from "../embeds/scrim-config";
import { BracketClient } from "@/base/classes/client";
import { prepareScrimConfigActionRow } from "../buttons/scrim-config-action-row";

export async function sendConfigMessage(
  channel: TextChannel,
  scrim: Scrim,
  client: BracketClient,
) {
  const scrimActionRow = prepareScrimConfigActionRow(scrim);
  const embed = scrimConfigEmbed(scrim, client);

  return await channel.send({
    embeds: [embed],
    components: [scrimActionRow],
  });
}

export async function editScrimConfigEmbed(
  scrim: Scrim,
  client: BracketClient,
) {
  const guild = client.guilds.cache.get(scrim.guildId);
  if (!guild) return;
  const adminChannel = guild.channels.cache.get(
    scrim.adminChannelId,
  ) as TextChannel;
  if (!adminChannel) return;
  let message: Message;
  if (!scrim.adminConfigMessageId) {
    message = await sendConfigMessage(adminChannel, scrim, client);
  } else {
    message = await adminChannel.messages.fetch(scrim.adminConfigMessageId);
    const embed = scrimConfigEmbed(scrim, client);
    const scrimActionRow = prepareScrimConfigActionRow(scrim);
    await message.edit({ embeds: [embed], components: [scrimActionRow] });
  }
}
