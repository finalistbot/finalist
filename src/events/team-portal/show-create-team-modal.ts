import {
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
} from "discord.js";
import { Event } from "@/base/classes/event";

function CreateTeamModal() {
  const rows: ActionRowBuilder<TextInputBuilder>[] = [];
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("team_name")
        .setLabel("Team Name")
        .setStyle(1)
        .setMinLength(2)
        .setMaxLength(100)
        .setPlaceholder("Enter your global team name")
        .setRequired(true)
    )
  );
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("team_ign")
        .setLabel("In-Game Name")
        .setStyle(1)
        .setMinLength(3)
        .setMaxLength(100)
        .setPlaceholder("Enter your in-game name")
        .setRequired(true)
    )
  );
  rows.push(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("team_tag")
        .setLabel("Tag Name")
        .setStyle(1)
        .setMinLength(2)
        .setMaxLength(100)
        .setPlaceholder("Set your team tag")
        .setRequired(false)
    )
  );

  return new ModalBuilder()
    .setCustomId(`create_team_submit`)
    .setTitle("Create Your Team")
    .addComponents(...rows);
}

export default class ShowGlobalTeamModel extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_create_team_modal") return;
    const modal = CreateTeamModal();
    await interaction.showModal(modal);
  }
}
