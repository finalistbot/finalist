import { Scrim, Stage } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function prepareScrimConfigComponents(scrim: Scrim) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`show_team_config_modal:${scrim.id}`)
      .setLabel("Configure Teams")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),

    new ButtonBuilder()
      .setCustomId(`show_scrim_timing_config_modal:${scrim.id}`)
      .setLabel("Set Timings")
      .setEmoji("⏱️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),

    new ButtonBuilder()
      .setCustomId(`toggle_scrim_slotlist_mode:${scrim.id}`)
      .setLabel(
        scrim.autoSlotList ? "Use Manual Slotlist" : "Use Auto Slotlist",
      )
      .setEmoji(scrim.autoSlotList ? "📝" : "⚡")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),

    new ButtonBuilder()
      .setCustomId(`toggle_scrim_registration_auto_close:${scrim.id}`)
      .setLabel(
        scrim.autoCloseRegistration
          ? "Disable Auto-Close"
          : "Enable Auto-Close",
      )
      .setEmoji(scrim.autoCloseRegistration ? "🚫" : "✅")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`start_registration:${scrim.id}`)
      .setLabel("Start Registration")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION),
  );
  return [row1, row2];
}
