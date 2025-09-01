import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Embed,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../base/classes/command";
import { prisma } from "../lib/prisma";
import { Scrim } from "@prisma/client";

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
  templates.map((template) => [template.value, template])
);

async function sendConfigMessage(channel: TextChannel, scrim: Scrim) {
  const scrimTeamConfig = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`show_team_config_modal:${scrim.id}`)
      .setLabel("Set Teams")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`show_scrim_timing_config_modal:${scrim.id}`)
      .setLabel("Set Timing")
      .setStyle(ButtonStyle.Primary)
  );

  const lines = [
    `Scrim Name: ${scrim.name}`,
    `Max Teams: ${scrim.maxTeams}`,
    `Players per Team: ${scrim.minPlayersPerTeam} - ${scrim.maxPlayersPerTeam}`,
    `Substitutes per Team: ${scrim.maxSubstitutePerTeam}`,
    `Registration Time: ${
      scrim.registrationStartTime?.toLocaleString() || "Not set"
    }`,
  ];
  const embed = new EmbedBuilder()
    .setTitle("Scrim Configuration")
    .setDescription(lines.join("\n"))
    .setColor("Green");

  await channel.send({
    embeds: [embed],
    components: [scrimTeamConfig],
  });
}

export default class CreateScrim extends Command {
  data = new SlashCommandBuilder()
    .setName("create")
    .setDescription("Create a new scrim")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of the scrim")
        .setRequired(true)
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
          }))
        )
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
      },
    });
    await sendConfigMessage(adminChannel, scrim);

    await interaction.editReply({
      content: `Scrim created successfully!`,
    });
  }
}
