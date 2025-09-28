import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";

function globalJoinTeamConfigModel() {
  const rows: ActionRowBuilder<TextInputBuilder>[] = [];
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("global_join_team_code")
        .setLabel("Global Team Code")
        .setStyle(1)
        .setMinLength(6)
        .setMaxLength(8)
        .setPlaceholder("Enter the 6 character team code")
        .setRequired(true)
    )
  );

  return new ModalBuilder()
    .setCustomId(`global_join_team_submit`)
    .setTitle("Join Global Team")
    .addComponents(...rows);
}
export default class ShowGlobalJoinTeamModel extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_join_team_model") return;
    const modal = globalJoinTeamConfigModel();
    await interaction.showModal(modal);
  }
}
