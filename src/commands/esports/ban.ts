import { Command } from "@/base/classes/command";
import { isUserBanned } from "@/checks/banned";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { mentionUser, safeRunChecks } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import {
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

export default class BanUser extends Command {
  data = new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a player from any event in this server.")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to ban").setRequired(true),
    )
    .setContexts(InteractionContextType.Guild);

  info: CommandInfo = {
    name: "ban",
    description: "Ban a player from any event in this server.",
    usageExamples: ["/ban user:@player"],
    category: "Esports",
  };

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const result = await safeRunChecks(interaction, isScrimAdmin);
    if (!result.success) {
      await interaction.editReply({
        content: result.reason,
      });
      return;
    }
    const user = interaction.options.getUser("user", true);
    const guildId = interaction.guildId;
    const isBanned = await isUserBanned(guildId, user.id);
    if (isBanned) {
      await interaction.editReply({
        content: `User ${mentionUser(user.id)} is already banned.`,
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
    await interaction.editReply({
      content: `User ${mentionUser(user.id)} has been banned.`,
    });
  }
}
