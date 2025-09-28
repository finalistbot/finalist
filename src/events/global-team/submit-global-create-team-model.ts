import { prisma } from "@/lib/prisma";
import { Interaction } from "discord.js";
import z from "zod";
import { Event } from "@/base/classes/event";
import { randomString } from "@/lib/utils";

const TeamConfigSchema = z.object({
  teamName: z.string().min(2).max(32),
  ign: z.string().max(100).optional(),
});

export default class GlobalTeamModelSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "global_team_config_submit") return;

    const rawBody = {
      teamName: interaction.fields.getTextInputValue("global_team_name"),
      ign: interaction.fields.getTextInputValue("global_team_ign"),
    };

    await interaction.deferReply({ flags: ["Ephemeral"] });
    const parsed = TeamConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const code = randomString(8);
    const data = parsed.data;
    await prisma.globalTeam.create({
      data: {
        name: data.teamName,
        ownerId: interaction.user.id,
        guildId: interaction.guildId!,
        InGameName: data.ign || "",
        code: code,
        GlobalTeamMember: {
          create: {
            userId: interaction.user.id,
            displayName: interaction.user.username,
          },
        },
      },
    });
    await interaction.editReply({
      content: `Your team **${data.teamName}** has been created! Share this code with others to let them join your team: **${code}**`,
    });
  }
}
