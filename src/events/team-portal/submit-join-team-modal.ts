import z from "zod";
import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";
import { prisma } from "@/lib/prisma";
import { MAX_TEAM_SIZE } from "@/lib/constants";
import { ensureUser } from "@/database";
const JoinTeamSchema = z.object({
  code: z.string().length(8),
  ign: z.string().min(3).max(100),
});

export default class GlobalJoinTeamModalSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "join_team_submit") return;
    const rawBody = {
      code: interaction.fields.getTextInputValue("join_team_code"),
      ign: interaction.fields.getTextInputValue("join_team_ign"),
    };
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const parsed = JoinTeamSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const data = parsed.data;

    const team = await prisma.team.findUnique({
      where: { code: data.code, guildId: interaction.guildId! },
      include: { teamMembers: true },
    });
    if (!team) {
      await interaction.editReply({
        content: `No team found with the provided code.`,
      });
      return;
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: {
        userId: interaction.user.id,
        teamId: team.id,
      },
    });

    if (existingMember) {
      await interaction.editReply({
        content: "You are already in this team.",
      });
      return;
    }

    // Check team size limit
    const currentTeamSize = team.teamMembers.length;
    if (currentTeamSize >= MAX_TEAM_SIZE) {
      await interaction.reply({
        content: `This team has reached the maximum size of ${MAX_TEAM_SIZE} players.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    await ensureUser(interaction.user);
    const memberCount = await prisma.teamMember.count({
      where: { teamId: team.id },
    });

    await prisma.teamMember.create({
      data: {
        userId: interaction.user.id,
        ingameName: data.ign,
        teamId: team.id,
        position: memberCount + 1,
      },
    });
    await interaction.editReply({
      content: `You have successfully joined the team **${team.name}**!`,
    });
  }
}
