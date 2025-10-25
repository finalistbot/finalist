import { Message, TextChannel } from "discord.js";

import { AssignedSlot, RegisteredTeam, Scrim, Team } from "@prisma/client";

import { prepareManageParticipantsComponent } from "../components/manage-participants-components";
import { registeredTeamDetailsEmbed } from "../embeds/registered-team-details";

import { BracketClient } from "@/base/classes/client";
import { prisma } from "@/lib/prisma";

async function sendTeamDetails(
  channel: TextChannel,
  team: RegisteredTeam,
  assignedSlot: AssignedSlot | null = null
) {
  const components = await prepareManageParticipantsComponent(
    team,
    assignedSlot
  );
  const embed = registeredTeamDetailsEmbed(team, assignedSlot);

  const teamMessage = await channel.send({
    embeds: [await embed],
    components,
  });
  await prisma.registeredTeam.update({
    where: { id: team.id },
    data: { messageId: teamMessage.id },
  });
  return teamMessage;
}

export async function editRegisteredTeamDetails(
  scrim: Scrim,
  team: RegisteredTeam,
  client: BracketClient
) {
  const guild = client.guilds.cache.get(scrim.guildId);
  if (!guild) return;
  const participantsChannel = guild.channels.cache.get(
    scrim.participantsChannelId
  ) as TextChannel;
  if (!participantsChannel) return;
  let message: Message;
  const assignedSlot = await prisma.assignedSlot.findFirst({
    where: { registeredTeamId: team.id, scrimId: scrim.id },
  });
  if (!team.messageId) {
    message = await sendTeamDetails(participantsChannel, team, assignedSlot);
  } else {
    message = await participantsChannel.messages.fetch(team.messageId);

    const embed = await registeredTeamDetailsEmbed(team, assignedSlot);
    const components = await prepareManageParticipantsComponent(
      team,
      assignedSlot || undefined
    );
    await message.edit({ embeds: [embed], components });
  }
}
