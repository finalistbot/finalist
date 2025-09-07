import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { openRegistration } from "@/services/scrim";
import { Stage } from "@prisma/client";
import { CacheType, Interaction } from "discord.js";

export default class StartRegistrationButtonHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("start_registration:")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.reply({
        content: "Invalid scrim ID.",
        flags: "Ephemeral",
      });
      return;
    }

    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      await interaction.reply({
        content: `Scrim with ID ${scrimId} does not exist.`,
        flags: "Ephemeral",
      });
      return;
    }

    if (scrim.stage != Stage.CONFIGURATION) {
      await interaction.reply({
        content: `Scrim with ID ${scrimId} is not in the configuration stage.`,
        flags: "Ephemeral",
      });
      return;
    }
    await openRegistration(scrimId);
    await interaction.reply({
      content: `Registration for scrim with ID ${scrimId} has been started.`,
      flags: "Ephemeral",
    });
  }
}
