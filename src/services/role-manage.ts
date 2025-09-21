import { ScrimService } from "./scrim";
import { Guild } from "discord.js";
import { Scrim, Team } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class RoleManageService extends ScrimService {
  async addParticipantRoleToTeam(team: Team) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: team.scrimId },
    });
    if (!scrim) throw new Error("Scrim not found");

    const guild = await this.client.guilds.fetch(scrim.guildId);
    if (!guild) throw new Error("Guild not found");

    const role = await this.ensureParticipantRole(guild, scrim);
    const teamMembers = await prisma.teamMember.findMany({
      where: { scrimId: scrim.id, teamId: team.id },
    });
    for (const member of teamMembers) {
      const guildMember = await guild.members.fetch(member.userId);
      await guildMember.roles.add(role);
    }
  }
  async removeParticipantRoleFromTeam(team: Team) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: team.scrimId },
    });
    if (!scrim) throw new Error("Scrim not found");

    const guild = await this.client.guilds.fetch(scrim.guildId);
    if (!guild) throw new Error("Guild not found");

    const role = guild.roles.cache.get(scrim.participantRoleId!);
    // Dont need role removing if it doesnt exist
    if (!role) return;

    const teamMembers = await prisma.teamMember.findMany({
      where: { scrimId: scrim.id, teamId: team.id },
    });
    for (const member of teamMembers) {
      const guildMember = await guild.members.fetch(member.userId);
      if (!guildMember || !guildMember.roles.cache.has(role!.id)) continue;

      await guildMember.roles.remove(role!);
    }
  }

  public async createParticipantRole(guild: Guild) {
    const role = await guild.roles.create({
      name: `Participant`,
      reason: `Creating a participant role for scrim management`,
    });
    return role;
  }

  async ensureParticipantRole(guild: Guild, scrim: Scrim) {
    let role = guild.roles.cache.get(scrim.participantRoleId!);
    if (!role) {
      role = await this.createParticipantRole(guild);
      await prisma.scrim.update({
        where: { id: scrim.id },
        data: { participantRoleId: role.id },
      });
    }
    return role;
  }
  async deleteParticipantRole(guild: Guild, scrim: Scrim) {
    const role = guild.roles.cache.get(scrim.participantRoleId!);
    if (role) {
      await role.delete("Deleting participant role as scrim is deleted");
    }
  }
}
