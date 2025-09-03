import { Command } from "@/base/classes/command";
import { checkIsBanned } from "@/checks/is-banned";
import { checkIsScrimAdminInteraction } from "@/checks/is-scrim-admin";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { mentionUser } from "@/lib/utils";
import {
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

export default class BanUser extends Command {
  data = new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a player")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to ban").setRequired(true),
    )
    .setContexts(InteractionContextType.Guild);

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const user = interaction.options.getUser("user", true);
    const isScrimAdmin = await checkIsScrimAdminInteraction(interaction);
    const guildId = interaction.guildId;
    if (!isScrimAdmin) {
      logger.info(
        `User ${interaction.user.tag} does not have permission to use create command in guild ${guildId}`,
        {
          guildId: guildId,
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
    const isBanned = await checkIsBanned(guildId, user.id);
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
        guildId: guildId,
      },
    });
    await interaction.reply({
      content: `User ${mentionUser(user.id)} has been banned.`,
      flags: ["Ephemeral"],
    });
  }
}
