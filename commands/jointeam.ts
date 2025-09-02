import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { teamDetailsEmbed } from "@/ui/embeds/team-details";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class JoinTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("jointeam")
    .setDescription("Join a team")
    .addStringOption((option) =>
      option
        .setName("teamcode")
        .setDescription("The code of the team to join")
        .setRequired(true),
    );
  async execute(interaction: ChatInputCommandInteraction) {
    const teamCode = interaction.options.getString("teamcode", true);
    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This channel is not set up for team registration.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const team = await prisma.team.findUnique({
      where: { code: teamCode.toLowerCase(), scrimId: scrim.id },
      include: { scrim: true, TeamMember: true },
    });

    if (!team) {
      await interaction.reply({
        content: "Invalid team code.",
        flags: ["Ephemeral"],
      });
      return;
    }

    if (scrim.maxPlayersPerTeam <= team.TeamMember.length) {
      await interaction.reply({
        content: "This team is already full.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        scrimId_userId: {
          scrimId: scrim.id,
          userId: interaction.user.id,
        },
      },
    });

    if (existingMember) {
      await interaction.reply({
        content: "You are already in a team for this scrim.",
        flags: ["Ephemeral"],
      });
      return;
    }

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        scrimId: scrim.id,
        userId: interaction.user.id,
        isCaptain: false,
      },
    });

    await interaction.reply({
      content: `You have joined the team **${team.name}**!`,
      flags: ["Ephemeral"],
    });
    const teamChannel = interaction.guild?.channels.cache.get(
      team.scrim.teamChannelId,
    );
    if (!teamChannel || !teamChannel.isTextBased()) {
      return;
    }
    if (!team.teamDetailsMessageId) {
      return;
    }
    const message = await teamChannel.messages.fetch(team.teamDetailsMessageId);
    if (!message) {
      return;
    }

    await message.edit({
      embeds: [await teamDetailsEmbed(team)],
    });
  }
}
