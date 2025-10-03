import { Interaction } from "discord.js";
import z from "zod";
import { Event } from "@/base/classes/event";
const TeamConfigSchema = z.object({
  teamName: z.string().min(2).max(32),
  ign: z.string().min(3).max(100),
  tag: z.string().max(10).optional(),
});

export default class TeamModelSubmit extends Event<"interactionCreate"> {
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
    const normalized = {
      ...parsed.data,
      tag: parsed.data.tag ?? "",
    };

    const team = await this.client.teamManageService.createTeam(
      interaction.user,
      interaction.guildId!,
      normalized
    );
    await interaction.editReply({
      content: `Team **${team.name}** created successfully! Your team code is: \`${team.code}\`. Share this code with your teammates to join your team.`,
    });
  }
}
