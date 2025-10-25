import { Guild, User } from "discord.js";

import { Stage, TeamRole } from "@prisma/client";

import { ScrimService } from "./scrim";

import { BracketError } from "@/base/classes/error";
import { isUserBanned } from "@/checks/banned";
import { ensureUser } from "@/database";
import { MAX_TEAM_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { randomString } from "@/lib/utils";

type CreateTeamData = {
  teamName: string;
  ign: string;
  tag?: string | null;
};
type JoinTeamData = {
  teamCode: string;
  ign: string;
  substitute?: boolean;
};
export class TeamManageService extends ScrimService {
  async createTeam(user: User, guildId: string, parsed: CreateTeamData) {
    const isBanned = await isUserBanned(guildId, user.id);
    if (isBanned) {
      throw new BracketError("You are banned from creating or joining teams.");
    }
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: guildId },
    });

    const maxTeamsPerCaptain = guildConfig?.teamsPerCaptain || 1;
    const existing = await prisma.team.findFirst({
      where: {
        guildId: guildId,
        name: parsed.teamName,
      },
    });
    if (existing) {
      throw new BracketError(
        `A team with the name **${parsed.teamName}** already exists. Please choose a different name.`
      );
    }
    const captainTeamsCount = await prisma.team.count({
      where: {
        guildId: guildId,
        teamMembers: {
          some: { userId: user.id, role: "CAPTAIN" },
        },
      },
    });

    if (captainTeamsCount >= maxTeamsPerCaptain) {
      throw new BracketError(
        `You have reached the maximum number of teams (${maxTeamsPerCaptain}) you can create as a captain.`
      );
    }
    const teamCode = randomString(8);
    await ensureUser(user);

    const newTeam = await prisma.team.create({
      data: {
        name: parsed.teamName,
        guildId: guildId,
        code: teamCode,
        tag: parsed.tag || null,
        teamMembers: {
          create: {
            userId: user.id,
            ingameName: parsed.ign,
            role: TeamRole.CAPTAIN,
          },
        },
      },
    });
    return newTeam;
  }
  async joinTeam(user: User, guildId: string, data: JoinTeamData) {
    const isBanned = await isUserBanned(guildId, user.id);
    if (isBanned) {
      throw new BracketError("You are banned from creating or joining teams.");
    }
    const team = await prisma.team.findUnique({
      where: { code: data.teamCode, guildId: guildId! },
      include: { teamMembers: true },
    });
    if (!team) {
      throw new BracketError("Invalid team code. Please try again.");
    }
    if (team.banned) {
      throw new BracketError("You cannot join a team that is banned.");
    }
    const registeredIn = await prisma.registeredTeam.count({
      where: { teamId: team.id, scrim: { stage: { not: Stage.COMPLETED } } },
    });
    if (registeredIn > 0) {
      throw new BracketError(
        "You cannot join a team that is registered for a scrim. Please contact staff for assistance."
      );
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        teamId: team.id,
      },
    });

    if (existingMember) {
      throw new BracketError("You are already in this team.");
    }

    // Check team size limit
    const currentTeamSize = team.teamMembers.length;
    if (currentTeamSize >= MAX_TEAM_SIZE) {
      throw new BracketError(
        `This team has reached the maximum size of ${MAX_TEAM_SIZE} players.`
      );
    }

    await ensureUser(user);
    const memberCount = await prisma.teamMember.count({
      where: { teamId: team.id },
    });

    const role = data.substitute ? TeamRole.SUBSTITUTE : TeamRole.MEMBER;

    await prisma.teamMember.create({
      data: {
        userId: user.id,
        ingameName: data.ign,
        teamId: team.id,
        position: memberCount + 1,
        role: role,
      },
    });
    return team;
  }
  async disbandTeam(guild: Guild, teamId: number, user: User) {
    const isBanned = await isUserBanned(guild.id, user.id);
    if (isBanned) {
      throw new BracketError("You are banned from creating or joining teams.");
    }
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        guildId: guild.id,
        teamMembers: { some: { userId: user.id, role: "CAPTAIN" } },
      },
      include: { teamMembers: true },
    });
    if (!team) {
      throw new BracketError(
        "The selected team does not exist or you are not a captain of the team."
      );
    }
    if (team.banned) {
      throw new BracketError("You cannot disband a team that is banned.");
    }
    const registeredIn = await prisma.registeredTeam.count({
      where: { teamId: team.id },
    });
    if (registeredIn > 0) {
      throw new BracketError(
        "You cannot disband a team that is registered for a scrim. Please contact staff for assistance."
      );
    }

    await prisma.team.delete({
      where: { id: team.id },
    });
    return team;
  }
  async leaveTeam(guild: Guild, teamId: number, user: User) {
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        team: { guildId: guild.id },
      },
      include: { team: true },
    });
    if (!teamMember) {
      throw new BracketError("You are not a member of this team.");
    }

    if (teamMember.team.banned) {
      throw new BracketError("You cannot leave a team that is banned.");
    }

    if (teamMember.role === TeamRole.CAPTAIN) {
      throw new BracketError(
        "You cannot leave the team as you are the captain. You can either disband the team or transfer captaincy to another member."
      );
    }
    const registeredIn = await prisma.registeredTeam.count({
      where: {
        teamId: teamMember.teamId,
        scrim: {
          stage: { not: Stage.COMPLETED },
        },
      },
    });
    if (registeredIn > 0) {
      throw new BracketError(
        "You cannot leave a team that is registered for a scrim. Please contact staff for assistance."
      );
    }

    await prisma.teamMember.delete({
      where: { id: teamMember.id },
    });
    return teamMember.team;
  }
  async kickMember(
    guild: Guild,
    user: User,
    teamId: number,
    memberToKick: string
  ) {
    const isBanned = await isUserBanned(guild.id, user.id);
    if (isBanned) {
      throw new BracketError("You are banned from creating or joining teams.");
    }
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: guild.id,
        teamMembers: {
          some: { role: "CAPTAIN", userId: user.id },
        },
      },
    });
    if (!team) {
      throw new BracketError(
        "You are not a captain of this team or the team does not exist in this server."
      );
    }
    if (team.banned) {
      throw new BracketError("This team is banned and cannot kick members.");
    }
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId: memberToKick },
    });
    if (!teamMember) {
      throw new BracketError("This user is not a member of the team.");
    }
    if (teamMember.role === "CAPTAIN") {
      throw new BracketError("You cannot kick a captain from the team.");
    }
    await prisma.teamMember.delete({
      where: { id: teamMember.id },
    });
    return team;
  }
}
