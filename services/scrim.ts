import { rest } from "@/lib/discord-rest";
import { prisma } from "@/lib/prisma";
import {
  Routes,
  RESTPatchAPIChannelJSONBody,
  PermissionFlagsBits,
} from "discord.js";

export async function openRegistration(scrimId: number) {
  const scrim = await prisma.scrim.findUnique({
    where: { id: scrimId },
  });
  if (!scrim) {
    return;
  }
  const body: RESTPatchAPIChannelJSONBody = {
    permission_overwrites: [
      {
        id: scrim.guildId,
        allow: (
          PermissionFlagsBits.ViewChannel |
          PermissionFlagsBits.SendMessages |
          PermissionFlagsBits.ReadMessageHistory
        ).toString(),
        type: 0,
      },
    ],
  };
  await rest.patch(Routes.channel(scrim.registrationChannelId), {
    body,
  });
}
