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
import { randomString } from "@/lib/utils";

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

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
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
    this.client.eventLogger.logEvent("teamRegistered", {
      team,
      trigger: {
        type: "user",
        userId: interaction.user.id,
        username: interaction.user.username,
      },
    });

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
        `Participants channel with ID ${scrim.participantsChannelId} not found`,
      );
      return;
    }
    await sendTeamDetails(channel as TextChannel, team, assignedSlot);
  }

  async registerTeam(
    scrim: Scrim,
    team: Team,
  ): Promise<
    | { success: true; assignedSlot: AssignedSlot | undefined }
    | { success: false; reason: string }
  > {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    });
    const teamSize = teamMembers.filter((t) => !t.isSubstitute).length;
    if (teamSize > scrim.maxPlayersPerTeam) {
      return {
        success: false,
        reason: `Your team has reached the maximum number of players (${scrim.maxPlayersPerTeam}).`,
      };
    }
    if (team.registeredAt)
      return { success: false, reason: "Your team is already registered." };

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

    const assignedSlot = await this.client.scrimService.assignTeamSlot(
      scrim,
      team,
    );

    return { success: true, assignedSlot };
  }

  async registerSoloTeam(
    scrim: Scrim,
    user: User,
  ): Promise<
    | { success: true; assignedSlot: AssignedSlot | undefined; team: Team }
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
