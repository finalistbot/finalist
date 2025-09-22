import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export class ScrimConfig extends Command {
  data = new SlashCommandBuilder()
    .setName("sconfig")
    .setDescription("Configure scrim settings")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("resend")
        .setDescription(
          "Resend the scrim configuration message to the admin channel",
        ),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "resend":
        return await this.resendConfigMessage(interaction);
      default:
        return interaction.reply({
          content: "Unknown subcommand.",
          flags: ["Ephemeral"],
        });
    }
  }

  async resendConfigMessage(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    await this.client.scrimService.updateScrimConfigMessage(scrim);
    await interaction.editReply({
      content: "Scrim configuration message has been resent or updated.",
    });
  }
}
