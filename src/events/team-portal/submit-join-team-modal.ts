import z from "zod";
import { Event } from "@/base/classes/event";
import { Interaction } from "discord.js";
const JoinTeamSchema = z.object({
  code: z.string().length(8),
  ign: z.string().min(3).max(100),
  substitute: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export default class GlobalJoinTeamModalSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== "join_team_submit") return;
    const rawBody = {
      code: interaction.fields.getTextInputValue("join_team_code"),
      ign: interaction.fields.getTextInputValue("join_team_ign"),
      substitute: interaction.fields.getTextInputValue("join_team_substitute"),
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

    const normalized = {
      teamCode: parsed.data.code,
      ign: parsed.data.ign,
      substitute: parsed.data.substitute ?? false,
    };
    const team = await this.client.teamManageService.joinTeam(
      interaction.user,
      interaction.guildId!,
      normalized,
    );
    await interaction.editReply({
      content: `You have successfully joined the team **${team.name}**!`,
    });
  }
}
