import { ButtonInteraction, Interaction } from "discord.js";

import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { isScrimAdmin } from "@/checks/scrim-admin";

import { IdentityInteraction } from "@/base/classes/identity-interaction";

export default class AutoSlotList extends IdentityInteraction<"button"> {
  id = "toggle_scrim_slotlist_mode";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.reply({
        content: "Invalid scrim ID.",
        flags: "Ephemeral",
      });
      return;
    }
    await interaction.deferReply({ flags: "Ephemeral" });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      return;
    }
    const updatedScrim = await prisma.scrim.update({
      where: { id: scrimId },
      data: { autoSlotList: !scrim.autoSlotList },
    });
    await this.client.scrimService.updateScrimConfigMessage(updatedScrim);
    await interaction.editReply({
      content: `Auto Slotlist is now ${
        !updatedScrim.autoSlotList ? "disabled" : "enabled"
      }.`,
    });
  }
}
