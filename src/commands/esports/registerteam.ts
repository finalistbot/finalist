import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
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
  async execute(interaction: ChatInputCommandInteraction) {
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
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    const registeredTeam = await this.client.scrimService.registerTeam(
      scrim,
      team,
    );
    await interaction.editReply({
      content: `Team **${registeredTeam.name}** has been successfully registered for the scrim! If you need to make any changes, please contact a staff member.`,
    });
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
