import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { Team } from "@prisma/client";

function createAssignSlotModal(team: Team, defaultSlot: number) {
  const modal = new ModalBuilder()
    .setTitle(`Assign Slot for ${team.name}`)
    .setCustomId(`assign_slot_submit:${team.id}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("slot_number")
          .setLabel("Slot Number")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Enter slot number")
          .setRequired(true)
          .setValue(defaultSlot.toString())
      )
    );

  return modal;
}

export default class AssignSlotModal extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("assign_slot_modal:")) return;
    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { scrim: true },
    });
    if (!team) {
      return;
    }
    const result = await prisma.$queryRaw<{ slot: number }[]>`
  SELECT MIN(s.slot_number) AS slot
    FROM generate_series(1, ${team.scrim.maxTeams}) AS s(slot_number)
    WHERE s.slot_number NOT IN (
      SELECT slot_number 
      FROM assigned_slot 
      WHERE scrim_id = ${team.scrimId}
  );`;
    const slot = result[0]?.slot ?? 1;
    if (slot > team.scrim.maxTeams) {
      await interaction.reply({
        content:
          "All slots are already assigned. Kindly use /assign-slot command.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const modal = createAssignSlotModal(team, slot);
    await interaction.showModal(modal);
  }
}
