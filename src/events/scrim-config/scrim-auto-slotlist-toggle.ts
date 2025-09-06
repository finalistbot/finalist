import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { editScrimConfigEmbed } from "@/ui/messages/scrim-config";
import { parseIdFromString } from "@/lib/utils";

export default class AutoSlotList extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("toggle_scrim_slotlist_mode")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
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
    await editScrimConfigEmbed(updatedScrim, this.client);
    await interaction.reply({
      content: `Auto Slotlist is now ${
        !scrim.autoSlotList ? "disabled" : "enabled"
      }.`,
      flags: "Ephemeral",
    });
  }
}
