import { CommandCheck } from "@/base/classes/check";
import { CheckFailure } from "@/base/classes/error";
import { prisma } from "@/lib/prisma";

export const isNotBanned: CommandCheck = async (interaction) => {
  const { guildId, user } = interaction;
  if (!guildId) return true;
  const bannedUser = await checkIsBanned(guildId, user.id);
  if (bannedUser) {
    throw new CheckFailure(
      "You are banned from using this bot in this server.",
    );
  }
  return true;
};

export const checkIsBanned = async (guildId: string, userId: string) => {
  const bannedUser = await prisma.bannedUser.findFirst({
    where: { guildId, userId },
  });
  return !!bannedUser;
};
