import { Scrim } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  TextChannel,
} from "discord.js";
import { scrimConfigEmbed } from "../embeds/scrim-config";
import { BracketClient } from "@/base/classes/client";

export async function sendConfigMessage(
  channel: TextChannel,
  scrim: Scrim,
  client: BracketClient,
) {
  const scrimTeamConfig = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`show_team_config_modal:${scrim.id}`)
      .setLabel("Set Teams")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`show_scrim_timing_config_modal:${scrim.id}`)
      .setLabel("Set Timing")
      .setStyle(ButtonStyle.Primary),
  );

  const embed = scrimConfigEmbed(scrim, client);

  return await channel.send({
    embeds: [embed],
    components: [scrimTeamConfig],
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
    await message.edit({ embeds: [embed] });
  }
}
