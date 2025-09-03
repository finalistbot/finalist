import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { editScrimConfigEmbed } from "@/ui/messages/scrim-config";

export default class ScrimTeamConfig extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (
      !interaction.customId.startsWith("toggle_scrim_registration_auto_close")
    )
      return;
    const [_, _scrimId] = interaction.customId.split(":");
    if (!_scrimId) {
      return;
    }
    const scrimId = parseInt(_scrimId);
    if (isNaN(scrimId)) {
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
    await editScrimConfigEmbed(updatedScrim, this.client);
    await interaction.reply({
      content: `Auto-Close Registration is now ${!scrim.autoCloseRegistration ? "disabled" : "enabled"}.`,
      flags: "Ephemeral",
    });
  }
}
