import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { safeRunChecks, suppress } from "@/lib/utils";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { CommandInfo } from "@/types/command";
import { popularTimeZones } from "@/lib/constants";
import { botHasPermissions } from "@/checks/permissions";

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
          "The timezone for the server (e.g., 'India (IST)'). Defaults to UTC if not set."
        )
        .setAutocomplete(true)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("teams-per-captain")
        .setDescription(
          "Number of teams each captain can create. Default is 1."
        )
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    );

  info: CommandInfo = {
    name: "setup",
    description: "Sets up the bot for the server.",
    category: "Esports",
    longDescription:
      "Sets up the bot for the server by creating an Admin role and setting the timezone.",
    usageExamples: ["/setup timezone:UTC teams-per-captain:2"],
    options: [
      {
        name: "timezone",
        description:
          "The timezone for the server (e.g., 'India (IST)'). Defaults to UTC if not set.",
        type: "STRING",
        required: false,
      },
      {
        name: "teams-per-captain",
        description: "Number of teams each captain can create. Default is 1.",
        type: "INTEGER",
        required: false,
      },
    ],
  };
  checks = [botHasPermissions("ManageRoles", "SendMessages", "EmbedLinks")];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: "Ephemeral" });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const timezone = interaction.options.getString("timezone") || "UTC";
    const teamsPerCaptain =
      interaction.options.getInteger("teams-per-captain") || 1;
    if (!popularTimeZones.find((tz) => tz.value === timezone)) {
      await interaction.editReply({
        content: "Please provide a valid timezone.",
      });
      return;
    }
    const guild = interaction.guild;
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: interaction.guildId },
    });
    let adminRole = null;
    if (guildConfig) {
      if (guildConfig.adminRoleId) {
        adminRole = await suppress(
          interaction.guild.roles.fetch(guildConfig.adminRoleId)
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
      where: { id: guild.id },
      create: {
        id: guild.id,
        adminRoleId: adminRole.id,
        teamsPerCaptain,
        timezone,
      },
      update: {
        adminRoleId: adminRole.id,
        teamsPerCaptain,
        timezone,
      },
    });
    await interaction.editReply({
      content: `The bot has been set up for this server. We have created ${adminRole} role for you. The timezone is set to ${timezone}.`,
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const filtered = popularTimeZones.filter(
      (tz) =>
        tz.label.toLowerCase().includes(focusedValue.toLowerCase()) ||
        tz.value.toLowerCase().includes(focusedValue.toLowerCase())
    );
    await interaction.respond(
      filtered.slice(0, 25).map((tz) => ({ name: tz.label, value: tz.value }))
    );
  }
}
