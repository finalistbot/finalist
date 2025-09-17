import { CacheType, Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { Stage } from "@prisma/client";

export default class CloseRegistrationButtonHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("close_registration:")) return;
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.editReply({
        content: "Invalid scrim ID.",
      });
      return;
    }

    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} does not exist.`,
      });
      return;
    }

    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} is not in the registration stage.`,
      });
      return;
    }

    await this.client.scrimService.closeRegistration(scrim);
    await interaction.editReply({
      content: `Registration for scrim with ID ${scrimId} has been closed.`,
    });
  }
}
