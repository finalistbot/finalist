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
        value: scrim.registrationStartTime
          ? scrim.registrationStartTime.toLocaleString()
          : "Not set",
        inline: false,
      },
    )
    .setFooter({ text: `Scrim ID: ${scrim.id}` })
    .setTimestamp(scrim.updatedAt)
    .setThumbnail(
      "https://media.discordapp.net/attachments/1412052318077325363/1412054104447909979/AJfQ9KTCEbSAM_ffB7GPypSvgXclkk-YpGh59OkYphUOCSzsdBvoh-TzSQ5_nny5eyTSosWpqPnTPOt7Ruw01kNodBZr-c_hzWJH_lHJ4s9dL-M_ryrHgGuvxoi3WzrDkRkkdz82YURDr75JVrA0gn9n4wkWb2uZPE_M5IN_WIQVjrMdWUqHEws1024.png?ex=68b6e55d&is=68b593dd&hm=dfb2a3a7dc7665432029c5be0f61fde482d28226ba60aa0ed7886aa63193f3e6&=&format=webp&quality=lossless&width=923&height=923",
    )
    .setAuthor({
      name: client.user?.username || "Scrim Bot",
    })
    .setImage(
      "https://media.discordapp.net/attachments/1412052318077325363/1412056963923054652/bracketlogocropped.png?ex=68b6e806&is=68b59686&hm=e764a3e0c028960e9f4cc27c84566d844665deb99250c53df66dc7f3f2e3ecb7&=&format=webp&quality=lossless&width=614&height=276",
    );
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
    await interaction.deferReply({ ephemeral: true });
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
