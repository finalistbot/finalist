import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { editRegisteredTeamDetails } from "@/ui/messages/teams";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export default class RegisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("registerteam")
    .setDescription("Register your team for the scrim")
    .addIntegerOption((option) =>
      option
        .setName("team")
        .setDescription("The team you want to register")
        .setRequired(true)
        .setAutocomplete(true),
    );
  async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const teamId = interaction.options.getInteger("team", true);
    await interaction.deferReply({ flags: ["Ephemeral"] });
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
      return interaction.editReply({
        content:
          "Team not found or you do not have permission to register this team",
      });
    }
    if (team.banned) {
      return interaction.editReply({
        content: `Your team is banned from participating in scrims.${
          team.banReason ? ` Reason: ${team.banReason}` : ""
        }`,
      });
    }
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    if (!scrim) {
      return interaction.editReply({
        content: "This channel is not set up for team registration",
      });
    }

    const existing = await prisma.registeredTeam.findUnique({
      where: { scrimId_teamId: { scrimId: scrim.id, teamId: team.id } },
    });
    if (existing) {
      return interaction.editReply({
        content: "This team is already registered for the scrim",
      });
    }
    const mainPlayers = team.teamMembers.filter(
      (tm) => tm.role != "SUBSTITUTE",
    );
    const subPlayers = team.teamMembers.filter(
      (tm) => tm.role === "SUBSTITUTE",
    );
    if (mainPlayers.length < scrim.minPlayersPerTeam) {
      return interaction.editReply({
        content: `Your team does not have enough main players to register. Minimum required is ${scrim.minPlayersPerTeam}.`,
      });
    }
    if (mainPlayers.length > scrim.maxPlayersPerTeam) {
      return interaction.editReply({
        content: `Your team has too many main players to register. Maximum allowed is ${scrim.maxPlayersPerTeam}.`,
      });
    }
    if (subPlayers.length > scrim.maxSubstitutePerTeam) {
      return interaction.editReply({
        content: `Your team has too many substitutes to register. Maximum allowed is ${scrim.maxSubstitutePerTeam}.`,
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
    await interaction.editReply({
      content: `Team **${team.name}** has been successfully registered for the scrim! If you need to make any changes, please contact a staff member.`,
    });
    await this.client.scrimService.assignTeamSlot(scrim, registeredTeam);
    await editRegisteredTeamDetails(scrim, registeredTeam, this.client);
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name !== "team") return;
    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId!,
        teamMembers: {
          some: {
            role: "CAPTAIN",
            userId: interaction.user.id,
          },
        },
        name: {
          contains: focusedOption.value,
          mode: "insensitive",
        },
      },
      take: 25,
    });
    await interaction.respond(
      teams.map((team) => {
        let name = team.name;
        if (team.tag) {
          name = `[${team.tag}] ${name}`;
        }
        return { name, value: team.id };
      }),
    );
  }
}
