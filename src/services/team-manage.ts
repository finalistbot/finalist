import { TeamRole } from "@prisma/client";
import { ScrimService } from "./scrim";
import { Guild, Interaction } from "discord.js";
import { prisma } from "@/lib/prisma";
import { BracketError } from "@/base/classes/error";
import { ensureUser } from "@/database";
import { randomString } from "@/lib/utils";
import { isUserBanned } from "@/checks/banned";

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
  async createTeam(
    user: Interaction["user"],
    guildId: Guild["id"],
    parsed: CreateTeamData
  ) {
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
}
