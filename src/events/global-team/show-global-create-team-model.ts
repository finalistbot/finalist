import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";

function globalTeamConfigModel() {
  const rows: ActionRowBuilder<TextInputBuilder>[] = [];
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("global_team_name")
        .setLabel("Global Team Name")
        .setStyle(1)
        .setMinLength(1)
        .setMaxLength(100)
        .setPlaceholder("Enter your global team name")
        .setRequired(true)
    )
  );
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("global_team_ign")
        .setLabel("In-Game Name")
        .setStyle(1)
        .setMinLength(0)
        .setMaxLength(100)
        .setPlaceholder("Enter your in-game name")
        .setRequired(false)
    )
  );

  return new ModalBuilder()
    .setCustomId(`global_team_config_submit`)
    .setTitle("Global Team Configuration")
    .addComponents(...rows);
}

export default class ShowGlobalTeamModel extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_create_team_modal") return;
    const modal = globalTeamConfigModel();
    await interaction.showModal(modal);
  }
}
