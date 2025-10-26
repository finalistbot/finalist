import {
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { Command } from "@/base/classes/command";
import { isUserBanned } from "@/checks/banned";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { mentionUser, safeRunChecks } from "@/lib/utils";
import { CommandInfo } from "@/types/command";

export default class UnbanUser extends Command {
  data = new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a player")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User ID of the player to unban")
        .setRequired(true)
    )
    .setContexts(InteractionContextType.Guild);

  info: CommandInfo = {
    name: "unban",
    description: "Unban a player from being banned in this server.",
    category: "Esports",
    usageExamples: ["/unban user:@player"],
  };

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const user = interaction.options.getUser("user", true);
    const guild = { id: interaction.guildId };
    const isBanned = await isUserBanned(guild.id, user.id);
    if (!isBanned) {
      await interaction.editReply({
        content: `User ${mentionUser(user.id)} is not banned.`,
      });
      return;
    }
    await prisma.bannedUser.deleteMany({
      where: {
        userId: user.id,
        guildId: guild.id,
      },
    });

    await interaction.editReply({
      content: `User ${user.tag} has been unbanned.`,
    });
  }
}
