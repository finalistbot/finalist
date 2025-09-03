import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ChannelType,
} from "discord.js";
import { Command } from "../base/classes/command";
import { prisma } from "../lib/prisma";

export default class SetupCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Sets up the bot for the server.")
    .setContexts(InteractionContextType.Guild);

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const guildConfig = await prisma.guildConfig.findFirst({
      where: { guildId: guild.id },
    });
    if (guildConfig) {
      await interaction.reply({
        content: "The bot is already set up for this server.",
        flags: ["Ephemeral"],
      });
      return;
    }
    await interaction.deferReply({ flags: "Ephemeral" });
    const adminRole = await guild.roles.create({
      name: "Admin",
      reason: "Admin role for the bot",
    });
    const updatesChannel = await guild.channels.create({
      name: "updates",
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ["ViewChannel"],
        },
        {
          id: adminRole.id,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });
    await prisma.guildConfig.create({
      data: {
        guildId: guild.id,
        adminRoleId: adminRole.id,
        updatesChannelId: updatesChannel.id,
        timezone: "UTC",
      },
    });
    await interaction.editReply({
      content: "The bot has been set up for this server.",
    });
  }
}
