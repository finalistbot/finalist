import { Event } from "@/base/classes/event";
import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, suppress } from "@/lib/utils";
import { Scrim } from "@prisma/client";
import {
  Interaction,
  CacheType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";

export default class OpenDaysConfiguration extends IdentityInteraction<"button"> {
  id = "open_days_config_show";
  type = "button" as const;

  async execute(interaction: ButtonInteraction) {
    await this.showConfiguration(interaction);
  }

  private buildConfigurationMessage(scrim: Scrim) {
    const daysButtons = DAYS_OF_WEEK.map((day, i) =>
      new ButtonBuilder()
        .setCustomId(`open_days_config_toggle:${scrim.id}:${i}`)
        .setLabel(day!)
        .setStyle(
          scrim.openDays.includes(i)
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        )
    );

    const chunks: ButtonBuilder[][] = [];
    for (let i = 0; i < daysButtons.length; i += 5) {
      chunks.push(daysButtons.slice(i, i + 5));
    }

    const actionRows = chunks.map((chunk) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(chunk)
    );

    return {
      content: "Select the days when the scrim is open:",
      components: actionRows,
    };
  }

  private async showConfiguration(interaction: ButtonInteraction) {
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) return;

    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) return;

    const messageData = this.buildConfigurationMessage(scrim);

    await interaction.reply({
      ...messageData,
      flags: ["Ephemeral"],
    });
  }

  private async updateConfiguration(
    interaction: ButtonInteraction,
    scrimId: number
  ) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) return;

    const messageData = this.buildConfigurationMessage(scrim);

    await interaction.editReply(messageData);
  }
}
