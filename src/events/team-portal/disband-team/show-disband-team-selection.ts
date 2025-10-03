import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  Interaction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

export default class ShowDisbandTeamSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_disband_team_selection") return;

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId,
        teamMembers: { some: { userId: interaction.user.id, role: "CAPTAIN" } },
      },
      include: { teamMembers: true },
    });
    if (teams.length === 0) {
      await interaction.editReply({
        content:
          "You are not a captain of any team in this server. You must be a captain to disband a team.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Disband Team")
      .setDescription("Select a team to disband")
      .setColor(BRAND_COLOR);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("submit_disband_team_selection")
        .setPlaceholder("Select a team to disband")
        .addOptions(
          teams.map((team) => ({
            label: team.name,
            description: `Team with ${team.teamMembers.length} members`,
            value: team.id.toString(),
          })),
        ),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
