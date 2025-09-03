import { prisma } from "@/lib/prisma";

export async function checkIsBanned(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const bannedUser = await prisma.bannedUser.findFirst({
    where: { guildId, userId },
  });
  return !!bannedUser;
}
