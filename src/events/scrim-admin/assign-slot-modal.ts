import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { Team } from "@prisma/client";
import { getFirstAvailableSlot } from "@/database";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { CheckFailure } from "@/base/classes/error";

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
          .setValue(defaultSlot.toString()),
      ),
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
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.reply({
        content: checkResult.reason,
        flags: ["Ephemeral"],
      });
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { scrim: true },
    });
    if (!team) {
      return;
    }
    const slot = await getFirstAvailableSlot(team.scrimId);
    if (slot === -1) {
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
