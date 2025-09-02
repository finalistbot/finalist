import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { randomString } from "@/lib/utils";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class RegisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("registerteam")
    .setDescription("Register a new team")
    .addStringOption((option) =>
      option
        .setName("teamname")
        .setDescription("The name of the team to register")
        .setRequired(true),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const teamName = interaction.options.getString("teamname", true);
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

    if (
      !scrim.registrationStartTime ||
      scrim.registrationStartTime > new Date()
    ) {
      await interaction.reply({
        content: "Team registration has not started yet.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const team = await prisma.$transaction(async (tx) => {
      const exists = (code: string) =>
        tx.team.findUnique({
          where: { code },
        });
      let code = randomString(6).toLowerCase();

      while (await exists(code)) {
        code = randomString(6).toLowerCase();
      }

      const team = await tx.team.create({
        data: {
          name: teamName,
          code,
          scrimId: scrim.id,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: interaction.user.id,
          isCaptain: true,
        },
      });

      return team;
    });

    await interaction.reply({
      content: `Team **${team.name}** registered successfully! Your team code is \`${team.code}\`. Share this code with your teammates so they can join your team.`,
      flags: ["Ephemeral"],
    });
  }
}
