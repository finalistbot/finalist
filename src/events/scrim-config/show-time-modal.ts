import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { Scrim } from "@prisma/client";
import * as dateFns from "date-fns";
import { parseIdFromString } from "@/lib/utils";
import { toZonedTime } from "date-fns-tz";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { CheckFailure } from "@/base/classes/error";

async function timingConfigModal(scrim: Scrim) {
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: scrim.guildId },
  });
  const input = new TextInputBuilder()
    .setCustomId("registrationStartTime")
    .setLabel("Registration Time (YYYY-MM-DD HH:MM)")
    .setStyle(1)
    .setMinLength(16)
    .setMaxLength(16)
    .setRequired(true)
    .setPlaceholder("e.g., 2024-12-31 15:30");

  if (scrim.registrationStartTime) {
    const zonedRegistrationTime = toZonedTime(
      scrim.registrationStartTime,
      guildConfig?.timezone || "UTC",
    );
    input.setValue(dateFns.format(zonedRegistrationTime, "yyyy-MM-dd HH:mm"));
  }
  return new ModalBuilder()
    .setCustomId(`scrim_timing_config_submit:${scrim.id}`)
    .setTitle("Scrim Timing Configuration")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
}

export default class ScrimTimingConfig extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("show_scrim_timing_config_modal"))
      return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) return;
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
    const modal = await timingConfigModal(scrim);
    await interaction.showModal(modal);
  }
}
