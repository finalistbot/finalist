import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { CommandInfo } from "@/types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class ScrimConfig extends Command {
  data = new SlashCommandBuilder()
    .setName("sconfig")
    .setDescription("Configure scrim settings")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("resend")
        .setDescription(
          "Resend the scrim configuration message to the admin channel",
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("captain-add-members")
        .setDescription("Toggle whether captains can add members to their team")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Enable or disable the feature")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("require-ingame-names")
        .setDescription(
          "Toggle whether in-game names are required for team members",
        )
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Enable or disable the feature")
            .setRequired(true),
        ),
    );

  info: CommandInfo = {
    name: "sconfig",
    description: "Configure scrim settings.",
    longDescription:
      "Commands to manage and configure scrim settings. Currently supports resending the configuration message to the admin channel.",
    usageExamples: ["/sconfig resend"],
    category: "Esports",
    subcommands: [
      {
        name: "resend",
        description:
          "Resend the scrim configuration message to the admin channel",
      },
      {
        name: "captain-add-members",
        description: "Toggle whether captains can add members to their team",
        options: [
          {
            name: "enabled",
            type: "BOOLEAN",
            description: "Enable or disable the feature",
            required: true,
          },
        ],
      },
      {
        name: "require-ingame-names",
        description:
          "Toggle whether in-game names are required for team members",
        options: [
          {
            name: "enabled",
            type: "BOOLEAN",
            description: "Enable or disable the feature",
            required: true,
          },
        ],
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "resend":
        return await this.resendConfigMessage(interaction);
      case "captain-add-members":
        return await this.toggleCaptainAddMembers(interaction);
      case "require-ingame-names":
        return await this.toggleRequireIngameNames(interaction);
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

  async toggleCaptainAddMembers(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const enabled = interaction.options.getBoolean("enabled", true);
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { captainAddMembers: enabled },
    });
    await this.client.scrimService.updateScrimConfigMessage(scrim);
    await interaction.editReply({
      content: `Captains can ${
        enabled ? "now" : "no longer"
      } add members to their team.`,
    });
  }

  async toggleRequireIngameNames(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const enabled = interaction.options.getBoolean("enabled", true);
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { requireIngameNames: enabled },
    });
    await this.client.scrimService.updateScrimConfigMessage(scrim);
    await interaction.editReply({
      content: `In-game names are ${
        enabled ? "now" : "no longer"
      } required for team members.`,
    });
  }
}
