import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  SlashCommandBuilder,
} from "discord.js";
import { Stage } from "@prisma/client";
import { closeRegistration, shouldCloseRegistration } from "@/services/scrim";
import { teamDetailsEmbed } from "@/ui/embeds/team-details";

// TODO: Automatically create a team for solo players and register them
export default class RegisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register for the scrim");

  async execute(interaction: ChatInputCommandInteraction) {
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

    if (scrim.stage !== Stage.REGISTRATION) {
      await interaction.reply({
        content: "Team registration is not open.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        scrimId: scrim.id,
        isCaptain: true,
        userId: interaction.user.id,
      },
    });

    if (!teamMember) {
      await interaction.reply({
        content:
          "You are not a captain of any team in this scrim. Please contact your team captain to register the team.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: teamMember.teamId,
      },
    });

    const mainPlayers = teamMembers.filter((member) => !member.isSubstitute);

    if (mainPlayers.length < scrim.minPlayersPerTeam) {
      await interaction.reply({
        content: `Your team does not have enough main players. Minimum required is ${scrim.minPlayersPerTeam}.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const team = await prisma.team.update({
      where: { id: teamMember.teamId },
      data: { registeredAt: new Date() },
    });
    await interaction.reply({
      content: `Your team has been successfully registered! You can no longer make changes to your team. If you want to make changes, please contact the scrim organizer.`,
      flags: ["Ephemeral"],
    });

    const needClosing = await shouldCloseRegistration(scrim.id);
    if (needClosing) {
      await closeRegistration(scrim.id);
    }
    if (scrim.teamsChannelId) {
      const embed = await teamDetailsEmbed(team);
      const teamChannel = this.client.channels.cache.get(
        scrim.teamsChannelId,
      ) as GuildTextBasedChannel;
      if (!teamChannel) return;
      await teamChannel.send({ embeds: [embed] });
    }
  }
}
