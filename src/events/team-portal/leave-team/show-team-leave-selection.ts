import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  ActionRowBuilder,
  EmbedBuilder,
  Interaction,
  StringSelectMenuBuilder,
} from "discord.js";

export default class ShowTeamLeaveSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_team_leave_selection") return;

    await interaction.deferReply({ flags: ["Ephemeral"] });
    const isBanned = await prisma.bannedUser.findFirst({
      where: {
        guildId: interaction.guildId!,
        userId: interaction.user.id,
      },
    });
    if (isBanned) {
      await interaction.editReply({
        content: "You are banned from creating or joining teams.",
      });
      return;
    }
    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId!,
        teamMembers: {
          some: { userId: interaction.user.id },
        },
      },
      include: { teamMembers: true },
    });
    if (teams.length === 0) {
      await interaction.editReply({
        content:
          "You are not a member of any team in this server. You must be a member to leave a team.",
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Leave Team")
      .setDescription(
        "Please select the team you want to leave from the dropdown below."
      )
      .setColor(BRAND_COLOR);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("submit_team_leave_selection")
        .setPlaceholder("Select a team to leave")
        .addOptions(
          teams.map((team) => ({
            label: team.name,
            description: `Team with ${team.teamMembers.length} members`,
            value: team.id.toString(),
          }))
        )
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
