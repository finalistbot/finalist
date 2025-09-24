import {
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  OverwriteResolvable,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import * as dateFns from "date-fns";
import { scrimTemplateMap } from "@/templates/scrim";
import { checkIsGuildSetup } from "@/checks/is-guild-setup";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { safeRunChecks } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import { botHasPermissions } from "@/checks/permissions";

type ScrimSettings = {
  maxTeams: number;
  minPlayersPerTeam: number;
  maxPlayersPerTeam: number;
  maxSubstitutePerTeam: number;
  autoSlotList: boolean;
  autoCloseRegistration: boolean;
  captainAddMembers: boolean;
};
export default class CreateScrim extends Command {
  data = new SlashCommandBuilder()
    .setName("create")
    .setDescription("Create a new scrim")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of the scrim")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50)
    )
    .addStringOption((option) =>
      option
        .setName("template")
        .setDescription("Template for the scrim")
        .setRequired(false)
        .addChoices(
          [...scrimTemplateMap.values()].map((template) => ({
            name: template.name,
            value: template.value,
          }))
        )
    )
    .addStringOption((option) =>
      option
        .setName("preset")
        .setDescription("Saved preset to use for the scrim")
        .setRequired(false)
    );

  info: CommandInfo = {
    name: "create",
    description: "Create a new scrim.",
    longDescription:
      "Create a new scrim with a specified name and optional template. The template pre-fills settings for common scrim types.",
    usageExamples: ["/create name:My Scrim template:Pubg - Solo"],
    category: "Esports",
    options: [
      {
        name: "name",
        description: "Name of the scrim",
        type: "STRING",
        required: true,
      },
      {
        name: "template",
        description: "Template for the scrim",
        type: "STRING",
        required: false,
        choices: [...scrimTemplateMap.values()].map((template) => ({
          name: template.name,
          value: template.value,
        })),
      },
    ],
  };
  checks = [
    botHasPermissions(
      "ManageChannels",
      "ManageRoles",
      "SendMessages",
      "ViewChannel",
      "ReadMessageHistory"
    ),
  ];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const adminCheckResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!adminCheckResult.success) {
      await interaction.editReply({
        content: adminCheckResult.reason,
      });
      return;
    }
    const guild = interaction.guild;
    const result = await checkIsGuildSetup(guild);
    if (!result.valid) {
      await interaction.editReply({
        content: result.message,
      });
      return;
    }
    const guildConfig = result.config;
    const templateValue = interaction.options.getString("template");
    const template = templateValue
      ? scrimTemplateMap.get(templateValue as any)
      : undefined;
    const presetName = interaction.options.getString("preset");
    if (presetName && template) {
      await interaction.editReply({
        content: "You can only use either a template or a preset, not both.",
      });
      return;
    }

    const name = interaction.options.getString("name", true);

    const botOverwrites: OverwriteResolvable = {
      id: this.client.user!.id,
      allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
    };
    const category = await guild.channels.create({
      name,
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

    const participantRole =
      await this.client.rolemanageService.createParticipantRole(guild);

    let scrim;
    if (presetName) {
      const preset = await prisma.scrimPreset.findFirst({
        where: { guildId: guild.id, name: presetName },
      });
      if (!preset) {
        await interaction.editReply({
          content: `No preset found with the name \`${presetName}\`.`,
        });
        return;
      }
      const settings = preset.settings as ScrimSettings;
      if (!settings) {
        await interaction.editReply({
          content: `Preset \`${presetName}\` has no settings saved.`,
        });
        return;
      }
      scrim = await prisma.scrim.create({
        data: {
          name,
          guildId: guild.id,
          maxTeams: settings.maxTeams,
          minPlayersPerTeam: settings.minPlayersPerTeam,
          maxPlayersPerTeam: settings.maxPlayersPerTeam,
          maxSubstitutePerTeam: settings.maxSubstitutePerTeam,
          discordCategoryId: category.id,
          adminChannelId: adminChannel.id,
          logsChannelId: logsChannel.id,
          participantsChannelId: participantsChannel.id,
          participantRoleId: participantRole.id,
          registrationChannelId: registrationChannel.id,
          adminConfigMessageId: "",
          registrationStartTime: dateFns.addDays(new Date(), 1),
          autoSlotList: settings.autoSlotList,
          autoCloseRegistration: settings.autoCloseRegistration,
          captainAddMembers: settings.captainAddMembers,
        },
      });
    } else {
      scrim = await prisma.scrim.create({
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
          participantsChannelId: participantsChannel.id,
          participantRoleId: participantRole.id,
          registrationChannelId: registrationChannel.id,
          adminConfigMessageId: "",
          registrationStartTime: dateFns.addDays(new Date(), 1),
        },
      });
      await this.client.scrimService.updateScrimConfigMessage(scrim);
      await this.client.scrimService.scheduleRegistrationStart(scrim);
    }

    await interaction.editReply({
      content: `Scrim created successfully!`,
    });
  }
}
