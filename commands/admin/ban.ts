import { CommandCheck } from "@/base/classes/check";
import { Command } from "@/base/classes/command";
import { isUserBanned } from "@/checks/banned";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
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

  checks = [checkIsScrimAdmin];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const user = interaction.options.getUser("user", true);
    const guildId = interaction.guildId;
    const isBanned = await isUserBanned(guildId, user.id);
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
