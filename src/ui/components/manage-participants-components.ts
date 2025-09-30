import { AssignedSlot, RegisteredTeam } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export async function prepareManageParticipantsComponent(
  team: RegisteredTeam,
  assignedSlot: AssignedSlot | null = null,
) {
  const assignSlotLabel = assignedSlot ? "Reassign Slot" : "Assign Slot";
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`assign_slot_modal:${team.id}`)
      .setLabel(assignSlotLabel)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`unassign_slot:${team.id}`)
      .setLabel("Unassign Slot")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!assignedSlot),
    new ButtonBuilder()
      .setCustomId(`kick_team:${team.id}`)
      .setLabel("Kick Team")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ban_team:${team.id}`)
      .setLabel("Ban Team")
      .setStyle(ButtonStyle.Danger),
  );

  return [row];
}
