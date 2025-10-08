import { Command } from "@/base/classes/command";
import { CommandInfo } from "@/types/command";
import {
  APIStringSelectComponent,
  ChatInputCommandInteraction,
  LabelBuilder,
  ModalBuilder,
  SlashCommandBuilder,
} from "discord.js";

export default class TestNewModals extends Command {
  data = new SlashCommandBuilder()
    .setName("test-new-modals")
    .setDescription("Test new modals");

  info: CommandInfo = {
    name: "test-new-modals",
    category: "Testing",
    description: "Test new modals",
    usageExamples: ["/test-new-modals"],
  };

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const modal = new ModalBuilder()
      .setCustomId("testModal")
      .setTitle("Test Modal")
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Team")
          .setStringSelectMenuComponent((builder) =>
            builder
              .setOptions(
                {
                  label: "Puddi",
                  value: "puddi",
                },
                {
                  label: "Mochi",
                  value: "mochi",
                },
              )
              .setCustomId("teamSelect"),
          ),
      );
    await interaction.showModal(modal);
  }
}
