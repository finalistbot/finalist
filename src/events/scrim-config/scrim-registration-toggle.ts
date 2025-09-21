import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { CheckFailure } from "@/base/classes/error";

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
      return;
    }
    try {
      await checkIsScrimAdmin(interaction);
    } catch (e) {
      if (e instanceof CheckFailure) {
        await interaction.reply({
          content: "You do not have permission to perform this action.",
          flags: "Ephemeral",
        });
        return;
      }
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
    await interaction.reply({
      content: `Auto-Close Registration is now ${!scrim.autoCloseRegistration ? "disabled" : "enabled"}.`,
      flags: "Ephemeral",
    });
  }
}
