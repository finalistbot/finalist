import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { sendTeamDetails } from "@/ui/messages/teams";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

export default class RegisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("registerteam")
    .setDescription("Register your team for the scrim")
    .addIntegerOption((option) =>
      option
        .setName("team")
        .setDescription("The team you want to register")
        .setRequired(true),
    );
  async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const teamId = interaction.options.getInteger("team", true);
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: {
          some: {
            role: "CAPTAIN",
            userId: interaction.user.id,
          },
        },
      },
      include: { teamMembers: true },
    });
    if (!team) {
      return interaction.reply({
        content:
          "Team not found or you do not have permission to register this team",
        flags: ["Ephemeral"],
      });
    }
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    if (!scrim) {
      return interaction.reply({
        content: "This channel is not set up for team registration",
        ephemeral: true,
      });
    }

    const existing = await prisma.registeredTeam.findUnique({
      where: { scrimId_teamId: { scrimId: scrim.id, teamId: team.id } },
    });
    if (existing) {
      return interaction.reply({
        content: "This team is already registered for the scrim",
        ephemeral: true,
      });
    }
    const mainPlayers = team.teamMembers.filter(
      (tm) => tm.role != "SUBSTITUTE",
    );
    const subPlayers = team.teamMembers.filter(
      (tm) => tm.role === "SUBSTITUTE",
    );
    if (mainPlayers.length < scrim.minPlayersPerTeam) {
      return interaction.reply({
        content: `Your team does not have enough main players to register. Minimum required is ${scrim.minPlayersPerTeam}.`,
        flags: ["Ephemeral"],
      });
    }
    if (mainPlayers.length > scrim.maxPlayersPerTeam) {
      return interaction.reply({
        content: `Your team has too many main players to register. Maximum allowed is ${scrim.maxPlayersPerTeam}.`,
        flags: ["Ephemeral"],
      });
    }
    if (subPlayers.length > scrim.maxSubstitutePerTeam) {
      return interaction.reply({
        content: `Your team has too many substitutes to register. Maximum allowed is ${scrim.maxSubstitutePerTeam}.`,
        flags: ["Ephemeral"],
      });
    }
    const registeredTeam = await prisma.registeredTeam.create({
      data: {
        name: team.name,
        scrimId: scrim.id,
        teamId: team.id,
        registeredTeamMembers: {
          create: team.teamMembers.map((tm) => ({
            userId: tm.userId,
            role: tm.role,
            ingameName: tm.ingameName,
            position: tm.position,
          })),
        },
      },
    });
    const assignedSlot = await this.client.scrimService.assignTeamSlot(
      scrim,
      registeredTeam,
    );
    await sendTeamDetails(
      interaction.channel as TextChannel,
      registeredTeam,
      assignedSlot,
    );
  }
}
