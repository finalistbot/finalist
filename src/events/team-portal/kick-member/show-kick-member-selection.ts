import { Event } from "@/base/classes/event";
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
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "show_kick_member_selection") return;
    if (!interaction.inGuild()) return;
    await interaction.deferUpdate();

    const teamId = parseInt(interaction.values[0]!);
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true },
    });
    if (members.length === 0) {
      await interaction.editReply({
        content: "This team has no members to kick.",
        components: [],
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Kick Team Member")
      .setDescription("Select a member to kick from the team");
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`kick_member_selection:${teamId}`)
        .setPlaceholder("Select a member to kick")
        .addOptions(
          members.map((member) => ({
            label: member.user.name,
            description: `Kick ${member.user.name} from the team`,
            value: member.userId,
          }))
        )
    );
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  }
}
