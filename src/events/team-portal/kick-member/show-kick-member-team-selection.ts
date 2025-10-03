import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  ActionRowBuilder,
  EmbedBuilder,
  Interaction,
  StringSelectMenuBuilder,
} from "discord.js";

export default class ShowKickTeamMemberSelection extends Event<"interactionCreate"> {
  event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_kick_member_team_selection") return;
    if (!interaction.inGuild()) return;
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId,
        teamMembers: {
          some: { userId: interaction.user.id, role: "CAPTAIN" },
        },
      },
      include: {
        teamMembers: true,
      },
    });
    if (teams.length === 0) {
      await interaction.editReply({
        content:
          "You are not a captain of any team in this server. You must be a captain to kick a member from a team.",
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Kick Team Member")
      .setDescription("Select a team to kick a member from:")
      .setColor(BRAND_COLOR);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("show_kick_member_selection")
        .setPlaceholder("Select a team to kick a member from")
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
