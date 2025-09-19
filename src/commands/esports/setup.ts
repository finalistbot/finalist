import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { CommandInfo } from "@/types/command";
import { popularTimeZones } from "@/lib/constants";

export default class SetupCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Sets up the bot for the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("timezone")
        .setDescription(
          "The timezone for the server (e.g., 'India (IST)'). Defaults to UTC if not set.",
        )
        .setAutocomplete(true)
        .setRequired(false),
    );

  info: CommandInfo = {
    name: "setup",
    description: "Sets up the bot for the server.",
    category: "Esports",
    longDescription:
      "Sets up the bot for the server by creating an admin role and an updates channel if they do not already exist.",
    usageExamples: [
      "/setup",
      "/setup timezone:India (IST)",
      "/setup timezone:US Eastern (New York)",
    ],
    options: [
      {
        name: "timezone",
        description:
          "The timezone for the server (e.g., 'India (IST)'). Defaults to UTC if not set.",
        type: "STRING",
        required: false,
      },
    ],
  };
  checks = [checkIsScrimAdmin];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const timezone = interaction.options.getString("timezone") || "UTC";
    if (!popularTimeZones.find((tz) => tz.value === timezone)) {
      await interaction.editReply({
        content: "Please provide a valid timezone.",
      });
      return;
    }
    const guild = interaction.guild;
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId },
    });
    let adminRole = null;
    if (guildConfig) {
      if (guildConfig.adminRoleId) {
        adminRole = await suppress(
          interaction.guild.roles.fetch(guildConfig.adminRoleId),
        );
      }
    }
    if (!adminRole) {
      adminRole = await guild.roles.create({
        name: "Admin",
        reason: "Admin role for the bot",
      });
    }
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      create: {
        guildId: guild.id,
        adminRoleId: adminRole.id,
        timezone,
      },
      update: {
        adminRoleId: adminRole.id,
        timezone,
      },
    });
    await interaction.editReply({
      content: "The bot has been set up for this server.",
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const filtered = popularTimeZones.filter(
      (tz) =>
        tz.label.toLowerCase().includes(focusedValue.toLowerCase()) ||
        tz.value.toLowerCase().includes(focusedValue.toLowerCase()),
    );
    await interaction.respond(
      filtered.slice(0, 25).map((tz) => ({ name: tz.label, value: tz.value })),
    );
  }
}
