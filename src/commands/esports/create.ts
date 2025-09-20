import {
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import * as dateFns from "date-fns";
import { scrimTemplateMap } from "@/templates/scrim";
import { checkIsGuildSetup } from "@/checks/is-guild-setup";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { convertToTitleCase } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import { Stage } from "@prisma/client";

export default class CreateScrim extends Command {
  data = new SlashCommandBuilder()
    .setName("create")
    .setDescription("Create a new scrim")
    .setContexts(InteractionContextType.Guild)
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
          [...scrimTemplateMap.values()].map((template) => ({
            name: template.name,
            value: template.value,
          })),
        ),
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
  checks = [checkIsScrimAdmin];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const guild = interaction.guild;
    await interaction.deferReply({ flags: ["Ephemeral"] });
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
    const name = convertToTitleCase(
      interaction.options.getString("name", true),
    );
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
      ],
    });

    const participantRole =
      await this.client.rolemanageService.createParticipantRole(guild);

    let scrim = await prisma.scrim.create({
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

    await interaction.editReply({
      content: `Scrim created successfully!`,
    });
  }
}
