import { Scrim } from "@prisma/client";
import {  Message, TextChannel } from "discord.js";
import { Team } from "@prisma/client";
import { prepareApproveTeamButton } from "../components/approve-team-components";
import { teamDetailsEmbed } from "../embeds/team-details";
import { BracketClient } from "@/base/classes/client";
import { prisma } from "@/lib/prisma";

export async function sendTeamDetails(
  channel: TextChannel,
  team: Team,
) {

  const components = await prepareApproveTeamButton(team);
  const embed = teamDetailsEmbed(team)
  

  const teamMessage = await channel.send({
    embeds: [await embed],
    components,
  });
  await prisma.team.update({
    where: { id: team.id },
    data: { teamDetailsMessageId: teamMessage.id },
  });
  return teamMessage;
  }


export async function editTeamDetails(
  scrim: Scrim,
  team: Team,
  client: BracketClient
) {
  
  const guild = client.guilds.cache.get(scrim.guildId);
  if (!guild) return;
  const teamChannel = guild.channels.cache.get(
    scrim.teamsChannelId,
  ) as TextChannel;
  if (!teamChannel) return;
  let message:Message
  if (!team.teamDetailsMessageId) {
    message = await sendTeamDetails(teamChannel,  team);
  } else{
    message = await teamChannel.messages.fetch(team.teamDetailsMessageId);

    const embed = await teamDetailsEmbed(team);
    const components = await prepareApproveTeamButton(team);
    await message.edit({ embeds: [embed], components });
  }
}
