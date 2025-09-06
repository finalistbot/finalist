import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";

export default class SetupCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Sets up the bot for the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild);

  checks = [checkIsScrimAdmin];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const guild = interaction.guild;
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId },
    });
    let adminRole = null;
    let updatesChannel = null;
    if (guildConfig) {
      if (guildConfig.adminRoleId) {
        adminRole = await suppress(
          interaction.guild.roles.fetch(guildConfig.adminRoleId),
        );
      }
      if (guildConfig.updatesChannelId) {
        updatesChannel = await suppress(
          interaction.guild.channels.fetch(guildConfig.updatesChannelId),
        );
      }
    }
    if (!adminRole) {
      adminRole = await guild.roles.create({
        name: "Admin",
        reason: "Admin role for the bot",
      });
    }
    if (!updatesChannel) {
      updatesChannel = await guild.channels.create({
        name: "updates",
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: ["ViewChannel"] },
          {
            id: adminRole.id,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
          },
        ],
      });
    }
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      create: {
        guildId: guild.id,
        adminRoleId: adminRole.id,
        updatesChannelId: updatesChannel.id,
        timezone: "UTC",
      },
      update: {
        adminRoleId: adminRole.id,
        updatesChannelId: updatesChannel.id,
      },
    });
    await interaction.editReply({
      content: "The bot has been set up for this server.",
    });
  }
}
