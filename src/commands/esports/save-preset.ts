import { Command } from "@/base/classes/command";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { safeRunChecks } from "@/lib/utils";
import {
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

export default class SavePresetCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("save-preset")
    .setDescription("Save the current scrim settings as a preset")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of the preset")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50)
    );

  info = {
    name: "save-preset",
    description: "Save the current scrim settings as a preset.",
    longDescription:
      "Save the current scrim settings as a preset for future use. This allows you to quickly apply the same settings to new scrims.",
    usageExamples: ["/save-preset"],
    category: "Esports",
    options: [],
  };
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });

    if (!scrim) {
      await interaction.reply({
        content: "This command can only be used in a scrim admin channel.",
        flags: ["Ephemeral"],
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const adminCheckResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!adminCheckResult.success) {
      await interaction.editReply({
        content: adminCheckResult.reason,
      });
      return;
    }
    const name = interaction.options.getString("name", true);

    const settings = {
      autoSlotList: scrim.autoSlotList,
      minPlayersPerTeam: scrim.minPlayersPerTeam,
      maxPlayersPerTeam: scrim.maxPlayersPerTeam,
      maxSubstitutePerTeam: scrim.maxSubstitutePerTeam,
      autoCloseRegistration: scrim.autoCloseRegistration,
      captainAddMembers: scrim.captainAddMembers,
    };
    await prisma.scrimPreset.upsert({
      where: { guildId_name: { guildId: interaction.guildId, name } },
      update: { settings },
      create: {
        guildId: interaction.guildId,
        name,
        settings,
      },
    });
    await interaction.editReply({
      content: `Preset \`${name}\` saved successfully!`,
    });
  }
}
