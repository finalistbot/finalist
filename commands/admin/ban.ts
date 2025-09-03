import { Command } from "@/base/classes/command";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { mentionUser } from "@/lib/utils";
import {
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
  SlashCommandBuilder,
} from "discord.js";

export default class BanUser extends Command {
  data = new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a player")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to ban").setRequired(true)
    );
  async execute(interaction: ChatInputCommandInteraction) {
    //TODO: refactor this
    const user = interaction.options.getUser("user", true);
    const guild = interaction.guild!;
    const memberRoles = interaction.member!.roles as GuildMemberRoleManager;
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: guild.id },
    });
    if (!guildConfig) {
      logger.info(`Guild ${guild.id} is not configured`, {
        guildId: guild.id,
        command: "create",
      });
      await interaction.reply({
        content:
          "Guild is not configured. Please run /setup to configure the guild.",
        flags: ["Ephemeral"],
      });
      return;
    }
    if (
      !interaction.memberPermissions!.has("ManageGuild") &&
      (!guildConfig.adminRoleId ||
        !memberRoles.cache.has(guildConfig.adminRoleId))
    ) {
      logger.info(
        `User ${interaction.user.tag} does not have permission to use create command in guild ${guild.id}`,
        {
          guildId: guild.id,
          userId: interaction.user.id,
          command: "create",
        }
      );
      await interaction.reply({
        content: "You do not have permission to use this command.",
        flags: ["Ephemeral"],
      });

      return;
    }
    const isBanned = await prisma.bannedUser.findFirst({
      where: { guildId: guild.id, userId: user.id },
    });
    if (isBanned) {
      await interaction.reply({
        content: `User ${mentionUser(user.id)} is already banned.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    await prisma.bannedUser.create({
      data: {
        userId: user.id,
        reason: `Banned by ${interaction.user.tag} (${interaction.user.id})`,
        guildId: guild.id,
      },
    });
    await interaction.reply({
      content: `User ${mentionUser(user.id)} has been banned.`,
      flags: ["Ephemeral"],
    });
  }
}
