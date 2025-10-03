import { TeamRole } from "@prisma/client";
import { ScrimService } from "./scrim";
import { Guild, User } from "discord.js";
import { prisma } from "@/lib/prisma";
import { BracketError } from "@/base/classes/error";
import { ensureUser } from "@/database";
import { randomString } from "@/lib/utils";
import { isUserBanned } from "@/checks/banned";
import { MAX_TEAM_SIZE } from "@/lib/constants";

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
        `A team with the name **${parsed.teamName}** already exists. Please choose a different name.`,
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
        `You have reached the maximum number of teams (${maxTeamsPerCaptain}) you can create as a captain.`,
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
    const team = await prisma.team.findUnique({
      where: { code: data.teamCode, guildId: guildId! },
      include: { teamMembers: true },
    });
    if (!team) {
      throw new BracketError("Invalid team code. Please try again.");
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
        `This team has reached the maximum size of ${MAX_TEAM_SIZE} players.`,
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
  async disbandTeam(guild: Guild, teamId: number, userId: string) {
    const isBanned = await isUserBanned(guild.id, userId);
    if (isBanned) {
      throw new BracketError("You are banned from creating or joining teams.");
    }
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        guildId: guild.id,
        teamMembers: { some: { userId: userId, role: "CAPTAIN" } },
      },
      include: { teamMembers: true },
    });
    if (!team) {
      throw new BracketError(
        "The selected team does not exist or you are not a captain of the team.",
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
        "You cannot disband a team that is registered for a scrim. Please contact staff for assistance.",
      );
    }

    await prisma.team.delete({
      where: { id: team.id },
    });
    return team;
  }
}
