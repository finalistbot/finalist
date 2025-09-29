import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { editRegisteredTeamDetails } from "@/ui/messages/teams";
import { Interaction } from "discord.js";
export default class AssignSlotSubmitEvent extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("assign_slot_submit:")) return;
    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
      return;
    }
    const scrim = await prisma.scrim.findFirst({
      where: { participantsChannelId: interaction.channelId! },
    });
    if (!scrim) {
      await interaction.reply({
        content: "Scrim not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const slotNumber = interaction.fields.getTextInputValue("slot_number");
    const slot = parseInt(slotNumber, 10);
    if (isNaN(slot) || slot <= 0) {
      await interaction.reply({
        content: "Please enter a valid positive integer for slot number.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { scrim: true },
    });
    if (!team) {
      await interaction.reply({
        content: "Team not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const scrimId = team.scrimId;
    const alreadyAssigned = await prisma.assignedSlot.findFirst({
      where: { scrimId, slotNumber: slot },
      include: { team: true },
    });
    if (alreadyAssigned && alreadyAssigned.teamId === teamId) {
      await interaction.reply({
        content: `Slot ${slot} is already assigned to this team.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    if (alreadyAssigned) {
      await interaction.reply({
        content: `Slot ${slot} is already assigned to team "${alreadyAssigned.team.name}". Please choose a different slot. Or use the unassign option first.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    await prisma.assignedSlot.deleteMany({
      where: { scrimId, teamId },
    });
    await this.client.scrimService.assignTeamSlot(scrim, team, slot);

    await interaction.reply({
      content: `Slot ${slot} assigned to team ID ${teamId}.`,
      flags: ["Ephemeral"],
    });
    await editRegisteredTeamDetails(team.scrim, team, this.client);
  }
}
