import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../base/classes/command";
import { prisma } from "../lib/prisma";
import { Scrim } from "@prisma/client";
import { BracketClient } from "../base/classes/client";
import * as dateFns from "date-fns";
import { discordTimestamp } from "@/lib/utils";

const templates = [
  {
    name: "PUBG - Squad",
    maxTeams: 25,
    minPlayersPerTeam: 4,
    maxPlayersPerTeam: 4,
    maxSubstitutePerTeam: 1,
    value: "pubg_squad",
  },
  {
    name: "PUBG - Duo",
    maxTeams: 50,
    minPlayersPerTeam: 2,
    maxPlayersPerTeam: 2,
    maxSubstitutePerTeam: 1,
    value: "pubg_duo",
  },
  {
    name: "PUBG - Solo",
    maxTeams: 100,
    minPlayersPerTeam: 1,
    maxPlayersPerTeam: 1,
    maxSubstitutePerTeam: 0,
    value: "pubg_solo",
  },
] as const;

const templateMap = new Map(
  templates.map((template) => [template.value, template]),
);

function createScrimConfigEmbed(scrim: Scrim, client: BracketClient) {
  return new EmbedBuilder()
    .setTitle("Scrim Configuration")
    .setColor("Green")
    .addFields(
      { name: "Scrim Name", value: scrim.name, inline: false },
      { name: "Max Teams", value: scrim.maxTeams.toString(), inline: false },
      {
        name: "Players per Team",
        value:
          scrim.minPlayersPerTeam && scrim.maxPlayersPerTeam
            ? scrim.minPlayersPerTeam === scrim.maxPlayersPerTeam
              ? `${scrim.minPlayersPerTeam} players`
              : `${scrim.minPlayersPerTeam}–${scrim.maxPlayersPerTeam} players`
            : "Not set",
        inline: false,
      },
      {
        name: "Substitutes per Team",
        value: scrim.maxSubstitutePerTeam.toString(),
        inline: false,
      },
      {
        name: "Registration Start Time",
        value: discordTimestamp(scrim.registrationStartTime),
        inline: false,
      },
    )
    .setFooter({
      text: `Scrim ID: ${scrim.id}\nYou can't edit after atleast one team has registered.`,
    })
    .setThumbnail("https://i.ibb.co/G4v0D8Zj/image.png")
    .setAuthor({
      name: client.user?.username || "Scrim Bot",
    })
    .setImage("https://i.ibb.co/XxXCWznH/image.png");
}

async function sendConfigMessage(channel: TextChannel, scrim: Scrim) {
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

  const embed = createScrimConfigEmbed(scrim, channel.client as BracketClient);

  return await channel.send({
    embeds: [embed],
    components: [scrimTeamConfig],
  });
}

export async function editScrimConfigEmbed(
  client: BracketClient,
  scrim: Scrim,
) {
  const guild = client.guilds.cache.get(scrim.guildId);
  if (!guild) return; // TODO: Might need to handle this case
  const adminChannel = guild.channels.cache.get(
    scrim.adminChannelId,
  ) as TextChannel;
  if (!adminChannel) return;
  let message: Message;
  if (!scrim.adminConfigMessageId) {
    message = await sendConfigMessage(adminChannel, scrim);
  } else {
    message = await adminChannel.messages.fetch(scrim.adminConfigMessageId);
    const embed = createScrimConfigEmbed(scrim, client);
    await message.edit({ embeds: [embed] });
  }
}

export default class CreateScrim extends Command {
  data = new SlashCommandBuilder()
    .setName("create")
    .setDescription("Create a new scrim")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of the scrim")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("template")
        .setDescription("Template for the scrim")
        .setRequired(false)
        .addChoices(
          ...templates.map((template) => ({
            name: template.name,
            value: template.value,
          })),
        ),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: guild.id },
    });
    if (!guildConfig) {
      await interaction.reply({
        content:
          "Guild is not configured. Please run /setup to configure the guild.",
        flags: ["Ephemeral"],
      });
      return;
    }
    if (
      !guildConfig.adminRoleId ||
      !guild.roles.cache.has(guildConfig.adminRoleId)
    ) {
      await interaction.reply({
        content:
          "Admin role is not set. Please run /setup to configure the guild.",
        flags: ["Ephemeral"],
      });
      return;
    }
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const templateValue = interaction.options.getString("template");
    const template = templateValue
      ? templateMap.get(templateValue as any)
      : undefined;
    const name = interaction.options.getString("name", true);
    const category = await guild.channels.create({
      name: `${name} - Scrim`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
      ],
    });
    const adminChannel = await category.children.create({
      name: "admin",
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });
    const logsChannel = await category.children.create({
      name: "logs",
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });
    const registrationChannel = await category.children.create({
      name: "register",
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });
    const scrim = await prisma.scrim.create({
      data: {
        name,
        guildId: guild.id,
        maxTeams: template ? template.maxTeams : 16,
        minPlayersPerTeam: template ? template.minPlayersPerTeam : 5,
        maxPlayersPerTeam: template ? template.maxPlayersPerTeam : 5,
        maxSubstitutePerTeam: template ? template.maxSubstitutePerTeam : 0,
        discordCategoryId: category.id,
        adminChannelId: adminChannel.id,
        logsChannelId: logsChannel.id,
        registrationChannelId: registrationChannel.id,
        adminConfigMessageId: "",
        registrationStartTime: dateFns.addDays(new Date(), 1),
      },
    });
    const message = await sendConfigMessage(adminChannel, scrim);
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { adminConfigMessageId: message.id },
    });

    await interaction.editReply({
      content: `Scrim created successfully!`,
    });
  }
}
