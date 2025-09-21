import { prisma } from "@/lib/prisma";
import { GuildMember, Interaction } from "discord.js";
import { type InteractionCheck } from "@/base/classes/check";
import { CheckFailure } from "@/base/classes/error";

export const isScrimAdmin: InteractionCheck = async (
  interaction: Interaction,
) => {
  if (!interaction.inGuild()) return false;
  const member = interaction.member as GuildMember;
  if (member.permissions.has("ManageGuild")) return true;
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  const isAdmin =
    guildConfig &&
    guildConfig.adminRoleId &&
    member.roles.cache.has(guildConfig.adminRoleId);
  if (!isAdmin) {
    throw new CheckFailure("You must be a scrim admin to use this command.");
  }
  return true;
};
