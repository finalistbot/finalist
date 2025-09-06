import { AssignedSlot, Scrim, Team } from "@prisma/client";
import { Message, TextChannel } from "discord.js";
import { prepareManageParticipantsComponent } from "../components/manage-participants-components";
import { teamDetailsEmbed } from "../embeds/team-details";
import { BracketClient } from "@/base/classes/client";
import { prisma } from "@/lib/prisma";

export async function sendTeamDetails(
  channel: TextChannel,
  team: Team,
  assignedSlot: AssignedSlot | null = null,
) {
  const components = await prepareManageParticipantsComponent(
    team,
    assignedSlot,
  );
  const embed = teamDetailsEmbed(team, assignedSlot);

  const teamMessage = await channel.send({
    embeds: [await embed],
    components,
  });
  await prisma.team.update({
    where: { id: team.id },
    data: { messageId: teamMessage.id },
  });
  return teamMessage;
}

export async function editTeamDetails(
  scrim: Scrim,
  team: Team,
  client: BracketClient,
) {
  const guild = client.guilds.cache.get(scrim.guildId);
  if (!guild) return;
  const participantsChannel = guild.channels.cache.get(
    scrim.participantsChannelId,
  ) as TextChannel;
  if (!participantsChannel) return;
  let message: Message;
  const assignedSlot = await prisma.assignedSlot.findFirst({
    where: { teamId: team.id },
  });
  if (!team.messageId) {
    message = await sendTeamDetails(participantsChannel, team, assignedSlot);
  } else {
    message = await participantsChannel.messages.fetch(team.messageId);

    const embed = await teamDetailsEmbed(team, assignedSlot);
    const components = await prepareManageParticipantsComponent(
      team,
      assignedSlot || undefined,
    );
    await message.edit({ embeds: [embed], components });
  }
}
