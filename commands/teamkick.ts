import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class TeamKick extends Command {
  data = new SlashCommandBuilder()
    .setName("teamkick")
    .setDescription("Kick a player from your team")
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The player to kick")
        .setRequired(true),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    });
    if (!scrim) {
      return interaction.reply({
        content:
          "This command can only be used in a scrim registration channel.",
        flags: ["Ephemeral"],
      });
    }
    const teammember = await prisma.teamMember.findUnique({
      where: {
        scrimId_userId: {
          scrimId: scrim.id,
          userId: interaction.user.id,
        },
      },
    });

    if (!teammember) {
      return await interaction.reply({
        content: "You are not registered in this scrim.",
        flags: ["Ephemeral"],
      });
    }

    if (!teammember.isCaptain) {
      return await interaction.reply({
        content: "Only team captains can kick players.",
        flags: ["Ephemeral"],
      });
    }

    const player = interaction.options.getUser("player", true);
    if (player.id === interaction.user.id) {
      return await interaction.reply({
        content: "You cannot kick yourself.",
        flags: ["Ephemeral"],
      });
    }
    const playerMember = await prisma.teamMember.findUnique({
      where: {
        scrimId_userId: {
          scrimId: scrim.id,
          userId: player.id,
        },
      },
    });
    if (!playerMember || playerMember.teamId !== teammember.teamId) {
      return await interaction.reply({
        content: "This player is not in your team.",
        flags: ["Ephemeral"],
      });
    }

    await prisma.teamMember.delete({
      where: {
        scrimId_userId: {
          scrimId: scrim.id,
          userId: player.id,
        },
      },
    });

    await interaction.reply({
      content: `${player} has been kicked from your team.`,
      flags: ["Ephemeral"],
    });
  }
}
