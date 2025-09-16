import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Stage } from "@prisma/client";
import { isUserBanned, checkIsNotBanned } from "@/checks/banned";
import { sendTeamDetails } from "@/ui/messages/teams";
import logger from "@/lib/logger";
import { getFirstAvailableSlot } from "@/database";
import { CommandInfo } from "@/types/command";

export default class RegisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register for the scrim");

  info: CommandInfo = {
    name: "register",
    description: "Register your team for the scrim in this channel.",
    category: "Esports",
    longDescription:
      "Register your team for the scrim in this channel. You must be a team captain to use this command. Once registered, you can no longer make changes to your team.",
    usageExamples: ["/register"],
  };
  checks = [checkIsNotBanned];

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
    // TODO: refactor this
    for (const member of teamMembers) {
      const isBanned = await isUserBanned(scrim.guildId, member.userId);
      if (isBanned) {
        await interaction.reply({
          content: `Your team cannot be registered as one of the members (${member.userId}) is banned from participating in this server`,
          flags: ["Ephemeral"],
        });
        return;
      }
    }

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

    const teamCaptain = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        isCaptain: true,
      },
    });

    if (!teamCaptain) {
      await interaction.reply({
        content: "Your team does not have a captain. Please contact support.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const reservedSlot = await prisma.reservedSlot.findFirst({
      where: {
        scrimId: scrim.id,
        userId: teamCaptain.userId,
      },
    });

    let assignedSlot = null;
    let performAutoSlot = reservedSlot || scrim.autoSlotList;
    if (performAutoSlot) {
      let slot = -1;
      if (reservedSlot) {
        slot = reservedSlot.slotNumber;
      } else {
        slot = await getFirstAvailableSlot(scrim.id);
        const participantRoleId = scrim.participantRoleId;
        const participantRole =
          interaction.guild?.roles.cache.get(participantRoleId);
        if (!participantRole) {
          logger.error(
            `Participant role with ID ${participantRoleId} not found in guild ${interaction.guild?.id}.`
          );
          return;
        }
        const members = await prisma.teamMember.findMany({
          where: { teamId: team.id },
        });
        const guild = interaction.guild;
        if (guild) {
          for (const member of members) {
            try {
              const guildMember = await guild.members.fetch(member.userId);
              await guildMember.roles.add(participantRole);
            } catch (error) {
              await interaction.followUp({
                content: `Failed to assign participant role to <@${member.userId}>. They might not be in the server.`,
                flags: ["Ephemeral"],
              });
            }
          }
        }
      }

      if (slot !== -1)
        assignedSlot = await prisma.assignedSlot.create({
          data: {
            scrimId: scrim.id,
            teamId: team.id,
            slotNumber: Number(slot),
          },
        });
    }

    await interaction.reply({
      content: `Your team has been successfully registered! You can no longer make changes to your team. If you want to make changes, please contact the scrim organizer.`,
      flags: ["Ephemeral"],
    });

    const needClosing =
      await this.client.scrimService.registrationNeedsClosing(scrim);
    if (needClosing) {
      await this.client.scrimService.closeRegistration(scrim);
    }
    const channel = this.client.channels.cache.get(scrim.participantsChannelId);
    if (!channel) {
      logger.error(
        `Participants channel with ID ${scrim.participantsChannelId} not found`
      );
      return;
    }
    await sendTeamDetails(channel as TextChannel, team, assignedSlot);
  }
}
