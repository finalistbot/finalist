import { Scrim, Stage } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function prepareScrimConfigComponents(scrim: Scrim) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`show_team_config_modal:${scrim.id}`)
      .setLabel("Set Teams")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),
    new ButtonBuilder()
      .setCustomId(`show_scrim_timing_config_modal:${scrim.id}`)
      .setLabel("Set Timing")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),
    new ButtonBuilder()
      .setCustomId(`toggle_scrim_registration_auto_close:${scrim.id}`)
      .setLabel(
        scrim.autoCloseRegistration ? "Disable Auto-Close" : "Enable Auto-Close"
      )
      .setStyle(
        scrim.autoCloseRegistration ? ButtonStyle.Danger : ButtonStyle.Success
      )
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),
    new ButtonBuilder()
      .setCustomId(`toggle_scrim_slotlist_mode:${scrim.id}`)
      .setLabel(
        scrim.autoSlotList
          ? "Switch to Manual Slotlist"
          : "Switch to Auto Slotlist"
      )
      .setStyle(scrim.autoSlotList ? ButtonStyle.Danger : ButtonStyle.Success)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION)
  );

  return [row];
}
