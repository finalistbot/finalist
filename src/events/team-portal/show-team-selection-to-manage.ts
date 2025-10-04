import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import {
  ActionRowBuilder,
  EmbedBuilder,
  Interaction,
  StringSelectMenuBuilder,
} from "discord.js";

export default class ShowTeamSelectionToManage extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_manage_team_options") return;

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
        guildId: interaction.guildId,
        teamMembers: { some: { userId: interaction.user.id } },
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
      .setTitle("Manage Teams")
      .setDescription("Select a team to manage it.");
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`show_manage_team_options`)
        .setPlaceholder("Select a team to manage")
        .addOptions(
          teams.map((t) => ({
            label: t.name,
            description: `Manage ${t.name}`,
            value: t.id.toString(),
          }))
        )
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
