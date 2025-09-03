import { Command } from "@/base/classes/command";
import { checkIsBanned } from "@/checks/is-banned";
import { checkIsScrimAdminInteraction } from "@/checks/is-scrim-admin";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { mentionUser } from "@/lib/utils";
import {
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

export default class UnbanUser extends Command {
  data = new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a player")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User ID of the player to unban")
        .setRequired(true),
    )
    .setContexts(InteractionContextType.Guild);
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const user = interaction.options.getUser("user", true);
    const guild = { id: interaction.guildId };
    const isScrimAdmin = await checkIsScrimAdminInteraction(interaction);
    if (!isScrimAdmin) {
      logger.info(
        `User ${interaction.user.tag} does not have permission to use create command in guild ${guild.id}`,
        {
          guildId: guild.id,
          userId: interaction.user.id,
          command: "create",
        },
      );
      await interaction.reply({
        content: "You do not have permission to use this command.",
        flags: ["Ephemeral"],
      });

      return;
    }
    const isBanned = await checkIsBanned(guild.id, user.id);
    if (!isBanned) {
      await interaction.reply({
        content: `User ${mentionUser(user.id)} is not banned.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    await prisma.bannedUser.deleteMany({
      where: {
        userId: user.id,
        guildId: guild.id,
      },
    });

    await interaction.reply({
      content: `User ${user.tag} has been unbanned.`,
      flags: ["Ephemeral"],
    });
  }
}
