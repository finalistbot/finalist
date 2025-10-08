import { Command } from "@/base/classes/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class PersonalizeCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("personalize")
    .setDescription("Personalize your experience with the bot")
    .addAttachmentOption((option) =>
      option
        .setName("avatar")
        .setDescription("Upload a custom avatar")
        .setRequired(true),
    );

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const avatar = interaction.options.getAttachment("avatar");
    if (!avatar) {
      await interaction.editReply({
        content: "Please upload an avatar",
      });
      return;
    }
    await interaction.guild.members.editMe({ avatar: avatar.url });
    await interaction.editReply({
      content: "Avatar updated successfully!",
    });
  }
}
