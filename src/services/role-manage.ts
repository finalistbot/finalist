import { ScrimService } from "./scrim";
import { ChatInputCommandInteraction, Guild, Interaction } from "discord.js";
import { Scrim, Team } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default class RoleManageService extends ScrimService {
  async setParticipantRole(team: Team) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: team.scrimId },
    });
    if (!scrim) throw new Error("Scrim not found");

    const guild = await this.client.guilds.fetch(scrim.guildId);
    if (!guild) throw new Error("Guild not found");

    const role = guild.roles.cache.get(scrim.participantRoleId!);
    if (!role) {
      const newRole = await this.createParticipantRole(guild, scrim);
      return newRole;
    }
    const teamMembers = await prisma.teamMember.findMany({
      where: { scrimId: scrim.id, teamId: team.id },
    });
    for (const member of teamMembers) {
      const guildMember = await guild.members.fetch(member.userId);
      if (!guildMember || guildMember.roles.cache.has(role.id)) continue;

      await guildMember.roles.add(role);
    }
  }
  async removeParticipantRole(team: Team) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: team.scrimId },
    });
    if (!scrim) throw new Error("Scrim not found");

    const guild = await this.client.guilds.fetch(scrim.guildId);
    if (!guild) throw new Error("Guild not found");

    const role = guild.roles.cache.get(scrim.participantRoleId!);
    if (!role) await this.createParticipantRole(guild, scrim);

    const teamMembers = await prisma.teamMember.findMany({
      where: { scrimId: scrim.id, teamId: team.id },
    });
    for (const member of teamMembers) {
      const guildMember = await guild.members.fetch(member.userId);
      if (!guildMember || !guildMember.roles.cache.has(role!.id)) continue;

      await guildMember.roles.remove(role!);
    }
  }

  async createParticipantRole(guild: Guild, scrim: Scrim) {
    const role = await guild.roles.create({
      name: `${scrim.name} - Participant`,
      reason: `Participant role for scrim ${scrim.name}`,
    });
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { participantRoleId: role.id },
    });
    return role;
  }
}
