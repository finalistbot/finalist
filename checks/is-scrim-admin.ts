import { prisma } from "@/lib/prisma";
import { GuildMember, Interaction } from "discord.js";

export async function checkIsScrimAdmin(member: GuildMember): Promise<boolean> {
  if (member.permissions.has("ManageGuild")) return true;
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  if (!guildConfig || !guildConfig.adminRoleId) return false;
  return member.roles.cache.has(guildConfig.adminRoleId);
}

export async function checkIsScrimAdminInteraction(interaction: Interaction) {
  if (!interaction.inGuild()) return false;
  const member = interaction.member as GuildMember;
  return await checkIsScrimAdmin(member);
}
