import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
  User,
} from "discord.js";
import { AssignedSlot, Scrim, Stage, Team } from "@prisma/client";
import { isUserBanned, checkIsNotBanned } from "@/checks/banned";
import { sendTeamDetails } from "@/ui/messages/teams";
import logger from "@/lib/logger";
import { getFirstAvailableSlot } from "@/database";
import { CommandInfo } from "@/types/command";
import { randomString, suppress } from "@/lib/utils";
import th from "zod/v4/locales/th.js";

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
        userId: interaction.user.id,
      },
      include: {
        team: { include: { TeamMember: true } },
      },
    });

    let team;
    let assignedSlot = null;

    if (!teamMember && scrim.minPlayersPerTeam == 1) {
      const result = await this.registerSoloTeam(scrim, interaction.user);
      if (result.success) {
        team = result.team;
        assignedSlot = result.assignedSlot;
      } else {
        await interaction.reply({
          content: result.reason,
          flags: ["Ephemeral"],
        });
        return;
      }
    } else if (!teamMember || !teamMember.isCaptain) {
      await interaction.reply({
        content:
          "You are not a captain of any team in this scrim. Please contact your team captain to register the team.",
        flags: ["Ephemeral"],
      });
      return;
    } else {
      const result = await this.registerTeam(scrim, teamMember.team);
      if (result.success) {
        team = teamMember.team;
        assignedSlot = result.assignedSlot;
      } else {
        await interaction.reply({
          content: result.reason,
          flags: ["Ephemeral"],
        });
        return;
      }
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

  async registerTeam(
    scrim: Scrim,
    team: Team
  ): Promise<
    | { success: true; assignedSlot: AssignedSlot | null }
    | { success: false; reason: string }
  > {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    });
    for (const member of teamMembers) {
      const isBanned = await isUserBanned(scrim.guildId, member.userId);
      if (isBanned) {
        return {
          success: false,
          reason: `Your team cannot be registered as one of the members (${member.userId}) is banned from participating in this server`,
        };
      }
    }
    const mainPlayers = teamMembers.filter((member) => !member.isSubstitute);
    if (mainPlayers.length < scrim.minPlayersPerTeam) {
      return {
        success: false,
        reason: `Your team does not have enough main players. Minimum required is ${scrim.minPlayersPerTeam}.`,
      };
    }

    team = await prisma.team.update({
      where: { id: team.id },
      data: { registeredAt: new Date() },
    });

    const teamCaptain = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        isCaptain: true,
      },
    });

    if (!teamCaptain) {
      return {
        success: false,
        reason: "Your team does not have a captain. Please contact support.",
      };
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
        const guild = this.client.guilds.cache.get(scrim.guildId);
        if (!guild) {
          return {
            success: false,
            reason: "Guild not found",
          };
        }
        const participantRoleId = scrim.participantsRoleId;
        const participantRole = guild?.roles.cache.get(participantRoleId);
        if (!participantRole) {
          return {
            success: false,
            reason: "Participant role not found",
          };
        }
        for (const member of teamMembers) {
          const guildMember = await guild.members.fetch(member.userId);
          if (!guildMember) continue;

          if (guildMember && !guildMember.roles.cache.has(participantRoleId)) {
            suppress(await guildMember.roles.add(participantRole));
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

    return { success: true, assignedSlot };
  }

  async registerSoloTeam(
    scrim: Scrim,
    user: User
  ): Promise<
    | { success: true; assignedSlot: AssignedSlot | null; team: Team }
    | { success: false; reason: string }
  > {
    const isBanned = await isUserBanned(scrim.guildId, user.id);
    if (isBanned) {
      return {
        success: false,
        reason: `You cannot register as you are banned from participating in this server`,
      };
    }
    const teamCode = randomString(8);
    const team = await prisma.team.create({
      data: {
        name: user.username,
        registeredAt: new Date(),
        code: teamCode,
        TeamMember: {
          create: {
            userId: user.id,
            isCaptain: true,
            displayName: user.username,
            scrim: { connect: { id: scrim.id } },
          },
        },
        scrim: { connect: { id: scrim.id } },
      },
    });
    const result = await this.registerTeam(scrim, team);
    if (result.success) {
      return { success: true, assignedSlot: result.assignedSlot, team };
    } else {
      await prisma.team.delete({ where: { id: team.id } });
      return { success: false, reason: result.reason };
    }
  }
}
