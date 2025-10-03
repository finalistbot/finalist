import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  ActionRowBuilder,
  EmbedBuilder,
  Interaction,
  StringSelectMenuBuilder,
} from "discord.js";
export default class ShowViemTeamSelection extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_view_team_selection") return;
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId,
        teamMembers: {
          some: { userId: interaction.user.id },
        },
      },
    });
    if (teams.length === 0) {
      await interaction.editReply({
        content: "You are not a member of any teams.",
        components: [],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("View Teams")
      .setDescription("Select a team to view its details.")
      .setColor(BRAND_COLOR);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("view_team_selection")
        .setPlaceholder("Select a team to view")
        .addOptions(
          teams.map((team) => ({
            label: team.name,
            description: `Register ${team.name} for the scrim`,
            value: team.id.toString(),
          }))
        )
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
