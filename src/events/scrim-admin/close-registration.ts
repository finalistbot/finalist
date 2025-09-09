import { CacheType, Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { parse } from "path";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, suppress } from "@/lib/utils";
import { Stage } from "@prisma/client";
import { closeRegistration } from "@/services/scrim";
import { editScrimConfigEmbed } from "@/ui/messages/scrim-config";

export default class CloseRegistrationButtonHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("close_registration:")) return;
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

    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.reply({
        content: `Scrim with ID ${scrimId} is not in the registration stage.`,
        flags: "Ephemeral",
      });
      return;
    }

    await closeRegistration(scrimId);

    scrim.stage = Stage.CHECKIN;
    await suppress(editScrimConfigEmbed(scrim, this.client));
    await interaction.reply({
      content: `Registration for scrim with ID ${scrimId} has been closed.`,
      flags: "Ephemeral",
    });
  }
}
