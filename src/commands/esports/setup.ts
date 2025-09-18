import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { CommandInfo } from "@/types/command";

export default class SetupCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Sets up the bot for the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild);

  info: CommandInfo = {
    name: "setup",
    description: "Sets up the bot for the server.",
    category: "Esports",
    longDescription:
      "Sets up the bot for the server by creating an admin role and an updates channel if they do not already exist.",
    usageExamples: ["/setup"],
  };
  checks = [checkIsScrimAdmin];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const guild = interaction.guild;
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId },
    });
    let adminRole = null;
    if (guildConfig) {
      if (guildConfig.adminRoleId) {
        adminRole = await suppress(
          interaction.guild.roles.fetch(guildConfig.adminRoleId),
        );
      }
    }
    if (!adminRole) {
      adminRole = await guild.roles.create({
        name: "Admin",
        reason: "Admin role for the bot",
      });
    }
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      create: {
        guildId: guild.id,
        adminRoleId: adminRole.id,
        timezone: "UTC",
      },
      update: {
        adminRoleId: adminRole.id,
      },
    });
    await interaction.editReply({
      content: "The bot has been set up for this server.",
    });
  }
}
