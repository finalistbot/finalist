import { prisma } from "@/lib/prisma";
import { Scrim, Team } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";



export async function prepareApproveTeamButton( team: Team) {

  const isApprove = await prisma.assignedSlot.findFirst({
    where: { teamId: team.id },
  });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_team_action:${team.id}:approve`)
      .setLabel("Approve Team")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isApprove ? true : false)
  );


  return [row];
}