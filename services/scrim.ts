import { rest } from "@/lib/discord-rest";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { editScrimConfigEmbed } from "@/ui/messages/scrim-config";
import { Stage } from "@prisma/client";
import {
  Routes,
  RESTPatchAPIChannelJSONBody,
  PermissionFlagsBits,
  RESTPostAPIChannelMessageJSONBody,
} from "discord.js";
import { client } from "@/client";

export async function openRegistration(scrimId: number) {
  const scrim = await prisma.scrim.findUnique({
    where: { id: scrimId },
  });
  if (!scrim || scrim.stage === Stage.REGISTRATION) {
    logger.warn(
      `Tried to open registration for scrim ${scrimId}, but it does not exist or is already open.`,
    );
    return;
  }
  const updatedScrim = await prisma.scrim.update({
    where: { id: scrimId },
    data: { stage: Stage.REGISTRATION },
  });
  await editScrimConfigEmbed(updatedScrim, client);
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
  const messageBody: RESTPostAPIChannelMessageJSONBody = {
    content: `Team registration is now open! Use the /team command to create your team and /registerteam to register your team.`,
  };
  await rest.post(Routes.channelMessages(scrim.registrationChannelId), {
    body: messageBody,
  });
}

export async function shouldCloseRegistration(scrimId: number) {
  const scrim = await prisma.scrim.findUnique({
    where: { id: scrimId },
    include: {
      Team: {
        where: { registeredAt: { not: null } },
      },
    },
  });
  if (!scrim) {
    logger.warn(
      `Tried to check if registration should be closed for scrim ${scrimId}, but it does not exist.`,
    );
    return false;
  }
  if (!scrim.autoCloseRegistration) {
    return false;
  }
  if (scrim.stage !== Stage.REGISTRATION) {
    logger.warn(
      `Tried to check if registration should be closed for scrim ${scrimId}, but it does not exist or is not open.`,
    );
    return false;
  }
  return scrim.Team.length >= scrim.maxTeams;
}

export async function closeRegistration(scrimId: number) {
  const scrim = await prisma.scrim.findUnique({
    where: { id: scrimId },
  });
  if (!scrim || scrim.stage !== Stage.REGISTRATION) {
    logger.warn(
      `Tried to close registration for scrim ${scrimId}, but it does not exist or is not open.`,
    );
    return;
  }
  const body: RESTPatchAPIChannelJSONBody = {
    permission_overwrites: [
      {
        id: scrim.guildId,
        deny: (
          PermissionFlagsBits.SendMessages |
          PermissionFlagsBits.ViewChannel |
          PermissionFlagsBits.ReadMessageHistory
        ).toString(),
        type: 0,
      },
    ],
  };
  await rest.patch(Routes.channel(scrim.registrationChannelId), {
    body,
  });
  await prisma.scrim.update({
    where: { id: scrimId },
    data: { stage: Stage.CHECKIN, registrationEndedTime: new Date() },
  });

  const newMessageBody: RESTPostAPIChannelMessageJSONBody = {
    content: `Team registration is now closed. Check-in is now open.`,
  };
  await rest.post(Routes.channelMessages(scrim.registrationChannelId), {
    body: newMessageBody,
  });
}
