import { prisma } from "@/lib/prisma";
import { Interaction } from "discord.js";
import z from "zod";
import { Event } from "@/base/classes/event";
import { randomString } from "@/lib/utils";
import { TeamRole } from "@prisma/client";
import { isUserBanned } from "@/checks/banned";
import { ensureUser } from "@/database";

const TeamConfigSchema = z.object({
  teamName: z.string().min(2).max(32),
  ign: z.string().min(3).max(100),
  tag: z.string().max(10).optional(),
});

export default class GlobalTeamModelSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "create_team_submit") return;

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const rawBody = {
      teamName: interaction.fields.getTextInputValue("team_name"),
      ign: interaction.fields.getTextInputValue("team_ign"),
      tag: interaction.fields.getTextInputValue("team_tag"),
    };

    const parsed = TeamConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: interaction.guildId! },
    });
    const maxTeamsPerCaptain = guildConfig?.teamsPerCaptain || 1;
    const existing = await prisma.team.findFirst({
      where: {
        guildId: interaction.guildId!,
        name: parsed.data.teamName,
      },
    });
    if (existing) {
      await interaction.editReply({
        content: `A team with the name **${parsed.data.teamName}** already exists. Please choose a different name.`,
      });
      return;
    }
    const captainTeamsCount = await prisma.team.count({
      where: {
        guildId: interaction.guildId!,
        teamMembers: {
          some: { userId: interaction.user.id, role: "CAPTAIN" },
        },
      },
    });

    if (captainTeamsCount >= maxTeamsPerCaptain) {
      await interaction.editReply({
        content: `You have reached the maximum number of teams (${maxTeamsPerCaptain}) you can create as a captain.`,
      });
      return;
    }
    const teamCode = randomString(8);
    await ensureUser(interaction.user);
    const data = parsed.data;
    await prisma.team.create({
      data: {
        name: data.teamName,
        guildId: interaction.guildId!,
        code: teamCode,
        tag: data.tag || null,
        teamMembers: {
          create: {
            userId: interaction.user.id,
            ingameName: data.ign!,
            role: TeamRole.CAPTAIN,
          },
        },
      },
    });
    await interaction.editReply({
      content: `Your team **${data.teamName}** has been created! Share this code with others to let them join your team:\` **${teamCode}**\``,
    });
  }
}
