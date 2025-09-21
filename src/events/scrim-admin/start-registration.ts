import { CheckFailure } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { Stage } from "@prisma/client";
import { CacheType, Interaction } from "discord.js";

export default class StartRegistrationButtonHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("start_registration:")) return;
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.editReply({
        content: "Invalid scrim ID.",
      });
      return;
    }
    try {
      await checkIsScrimAdmin(interaction);
    } catch (e) {
      if (e instanceof CheckFailure) {
        await interaction.editReply({
          content: "You do not have permission to perform this action.",
        });
        return;
      }
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

    if (scrim.stage != Stage.CONFIGURATION) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} is not in the configuration stage.`,
      });
      return;
    }
    await this.client.scrimService.openRegistration(scrim);
    await interaction.editReply({
      content: `Registration for scrim with ID ${scrimId} has been started.`,
    });
  }
}
