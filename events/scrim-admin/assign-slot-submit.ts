import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { editTeamDetails } from "@/ui/messages/teams";
export default class AssignSlotSubmitEvent extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: any) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("assign_slot_submit:")) return;
    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
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
    await prisma.assignedSlot.upsert({
      where: { scrimId_teamId: { scrimId, teamId } },
      create: { scrimId, teamId, slotNumber: slot },
      update: { slotNumber: slot },
    });
    await interaction.reply({
      content: `Slot ${slot} assigned to team ID ${teamId}. (This is a placeholder response.)`,
      flags: ["Ephemeral"],
    });
    await editTeamDetails(team.scrim, team, this.client);
  }
}
