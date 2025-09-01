import {
  ActionRowBuilder,
  Events,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { BracketClient } from "../base/classes/client";
import { Event } from "../base/classes/event";
import { prisma } from "../lib/prisma";
import { Scrim } from "@prisma/client";
import * as dateFns from "date-fns";

function timingConfigModal(scrim: Scrim) {
  const input = new TextInputBuilder()
    .setCustomId("registrationStartTime")
    .setLabel("Registration Time (YYYY-MM-DD HH:MM)")
    .setStyle(1)
    .setMinLength(16)
    .setMaxLength(16)
    .setRequired(true)
    .setPlaceholder("e.g., 2024-12-31 15:30");

  if (scrim.registrationStartTime) {
    input.setValue(
      dateFns.format(scrim.registrationStartTime, "yyyy-MM-dd HH:mm")
    );
  }
  return new ModalBuilder()
    .setCustomId(`scrim_timing_config_submit:${scrim.id}`)
    .setTitle("Scrim Timing Configuration")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input)
    );
}

export default class ScrimTimingConfig extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.InteractionCreate, once: false });
  }
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("show_scrim_timing_config_modal"))
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
    const modal = timingConfigModal(scrim);
    await interaction.showModal(modal);
  }
}
