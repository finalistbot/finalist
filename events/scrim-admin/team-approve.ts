import { prisma } from "@/lib/prisma";
import { parseScrimId } from "@/lib/utils";
import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { editTeamDetails } from "@/ui/messages/teams";

export default class TeamApprove extends Event<"interactionCreate"> {

  public event = "interactionCreate" as const

  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("admin_team_action:")) return;
    const teamId = parseScrimId(interaction.customId)
    if (!teamId) {
      return;
    }
    const parts = interaction.customId.split(":")

    const action = parts[2];
    if (!action) {
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { scrim: true },
    });


    if (!team) {
      return;
    }
    const lastAssignedSlot = await prisma.assignedSlot.findFirst({
      where: { scrimId: team.scrimId },
      orderBy: { slotNumber: "desc" },
    });

    const nextSlotNumber = lastAssignedSlot ? lastAssignedSlot.slotNumber + 1 : 1;

    if (action === "approve") {
      const assignedSlot = await prisma.assignedSlot.create({
        data: {
          teamId: teamId,
          scrimId: team.scrimId,
          slotNumber: nextSlotNumber
        },
      })
      await interaction.reply({
        content: `Team ${team.name} has been approved and assigned to slot ${assignedSlot.slotNumber}.`,
        ephemeral: true,
      });
// TODO: Fix Send embed after click on approve button

      await editTeamDetails(team.scrim, team, this.client)
    }
  }
}