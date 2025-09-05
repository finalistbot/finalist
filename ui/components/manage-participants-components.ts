import { AssignedSlot, Team } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export async function prepareManageParticipantsComponent(
  team: Team,
  assignedSlot: AssignedSlot | null = null,
) {
  const assignSlotLabel = assignedSlot ? "Reassign Slot" : "Assign Slot";
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`assign_slot_modal:${team.id}`)
      .setLabel(assignSlotLabel)
      .setStyle(ButtonStyle.Success),
  );

  return [row];
}
