import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { prisma } from "@/lib/prisma";

export default class ShowTeamSelectionToManage extends IdentityInteraction<"button"> {
  id = "show_manage_team_options";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
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
        teamMembers: { some: { userId: interaction.user.id } },
      },
      include: { teamMembers: true },
    });
    if (teams.length === 0) {
      await interaction.editReply({
        content: "You are not a member of any teams.",
        components: [],
      });
      return;
    }
    const memberRole = teams.reduce((acc, team) => {
      const member = team.teamMembers.find(
        (m) => m.userId === interaction.user.id
      );
      if (member) acc.set(team.id, member.role);

      return acc;
    }, new Map<number, string>());

    const modal = new ModalBuilder()
      .setTitle("Manage Team")
      .setCustomId("team_select_modal")
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Select a team to manage")
          .setStringSelectMenuComponent((builder: StringSelectMenuBuilder) =>
            builder
              .setCustomId("team")
              .setPlaceholder("Select a team")
              .setOptions(
                teams.map((team) => ({
                  label: team.name,
                  description: `Role: ${memberRole.get(team.id)} | Tag: ${team.tag ?? "N/A"}`,
                  value: team.id.toString(),
                }))
              )
          )
      );
    await interaction.showModal(modal);
  }
}
