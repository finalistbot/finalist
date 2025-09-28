import z from "zod";
import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";
import { prisma } from "@/lib/prisma";
const JoinTeamSchema = {
  code: z.string().length(8),
};

export default class GlobalJoinTeamModalSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "global_join_team_submit") return;
    const rawBody = {
      code: interaction.fields.getTextInputValue("global_join_team_code"),
    };
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const parsed = JoinTeamSchema.code.safeParse(rawBody.code);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const data = parsed.data;
    const team = await prisma.globalTeam.findUnique({
      where: { code: data },
    });
    if (!team) {
      await interaction.editReply({
        content: `No team found with the provided code.`,
      });
      return;
    }
    await prisma.globalTeamMember.create({
      data: {
        userId: interaction.user.id,
        displayName: interaction.user.username,
        teamId: team.id,
      },
    });
    await interaction.editReply({
      content: `You have successfully joined the team **${team.name}**!`,
    });
  }
}
