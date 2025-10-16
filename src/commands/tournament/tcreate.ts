import { Command } from "@/base/classes/command";
import { checkIsGuildSetup } from "@/checks/is-guild-setup";
import { prisma } from "@/lib/prisma";
import { CommandInfo } from "@/types/command";
import { BracketType } from "@prisma/client";
import {
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  OverwriteResolvable,
  SlashCommandBuilder,
} from "discord.js";
import * as dateFns from "date-fns";

export default class TournamentCreate extends Command {
  data = new SlashCommandBuilder()
    .setName("tcreate")
    .setDescription("Create a new tournament")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of the tournament")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50)
    );
  info: CommandInfo = {
    name: "tcreate",
    description: "Create a new tournament.",
    longDescription: "Create a new tournament with a specified name.",
    usageExamples: ["/tcreate name:My Tournament"],
    category: "Tournament",
    options: [
      {
        name: "name",
        description: "Name of the tournament",
        type: "STRING",
        required: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const guild = interaction.guild;
    if (!guild) {
      return interaction.editReply({
        content: "This command can only be used in a server.",
      });
    }
    const result = await checkIsGuildSetup(guild);
    if (!result.valid) {
      return interaction.editReply({ content: result.message });
    }
    const guildConfig = result.config;
    const name = interaction.options.getString("name", true);

    const botOverwrites: OverwriteResolvable = {
      id: this.client.user!.id,
      allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
    };
    const category = await guild.channels.create({
      name: `${name}`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
        botOverwrites,
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
        botOverwrites,
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
        botOverwrites,
      ],
    });
    const participantsChannel = await category.children.create({
      name: "participants",
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ["ViewChannel", "ReadMessageHistory"],
        },
        botOverwrites,
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
        botOverwrites,
      ],
    });
    const resultChannel = await category.children.create({
      name: "results",
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
        botOverwrites,
      ],
    });
    const chatChannel = await category.children.create({
      name: "chat",
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
        botOverwrites,
      ],
    });
    const voiceChannel = await category.children.create({
      name: `${name}-voice`,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel", "Connect"],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ["ViewChannel", "Connect", "Speak", "UseVAD"],
        },
        botOverwrites,
      ],
    });

    const tournament = await prisma.tournament.create({
      data: {
        guildId: guild.id,
        name: name,
        discordCategoryId: category.id,
        adminChannelId: adminChannel.id,
        logsChannelId: logsChannel.id,
        resultsChannelId: resultChannel.id,
        registrationChannelId: registrationChannel.id,
        participantsChannelId: participantsChannel.id,
        chatChannelId: chatChannel.id,
        participantRoleId: "",
        registrationStartTime: dateFns.addDays(new Date(), 1),
        bracketType: BracketType.SINGLE_ELIMINATION,
        maxTeams: 16,
        maxPlayersPerTeam: 5,
        minPlayersPerTeam: 1,
        maxSubstitutePerTeam: 0,
        best_of: 3,
      },
    });
    return interaction.editReply({
      content: `Tournament **${tournament.name}** has been created!`,
    });
  }
}
