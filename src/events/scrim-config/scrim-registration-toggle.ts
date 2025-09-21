import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { isScrimAdmin } from "@/checks/scrim-admin";

export default class ScrimTeamConfig extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (
      !interaction.customId.startsWith("toggle_scrim_registration_auto_close")
    )
      return;
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
      data: { autoCloseRegistration: !scrim.autoCloseRegistration },
    });
    await this.client.scrimService.updateScrimConfigMessage(updatedScrim);
    await interaction.editReply({
      content: `Auto-Close Registration is now ${!scrim.autoCloseRegistration ? "disabled" : "enabled"}.`,
    });
  }
}
