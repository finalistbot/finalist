import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";

function createTeamModal() {
  const rows: ActionRowBuilder<TextInputBuilder>[] = [];
  (rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("join_team_code")
        .setLabel("Team Code")
        .setStyle(1)
        .setMinLength(6)
        .setMaxLength(8)
        .setPlaceholder("Enter the 6 character team code")
        .setRequired(true),
    ),
  ),
    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("join_team_ign")
          .setLabel("In-Game Name")
          .setStyle(1)
          .setMinLength(3)
          .setMaxLength(100)
          .setPlaceholder("Enter your in-game name")
          .setRequired(true),
      ),
    ),
    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("join_team_substitute")
          .setLabel("Substitute (true/false)")
          .setStyle(1)
          .setMinLength(4)
          .setMaxLength(5)
          .setPlaceholder("Are you joining as a substitute? (true/false)")
          .setRequired(false)
          .setValue("false"),
      ),
    ));

  return new ModalBuilder()
    .setCustomId(`join_team_submit`)
    .setTitle("Join Team")
    .addComponents(...rows);
}
export default class ShowGlobalJoinTeamModel extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_join_team_model") return;
    const modal = createTeamModal();
    await interaction.showModal(modal);
  }
}
