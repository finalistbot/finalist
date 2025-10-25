import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import { v4 as uuid4 } from "uuid";

import { BracketError } from "@/base/classes/error";
import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { prisma } from "@/lib/prisma";

export default class KickMemberFromteam extends IdentityInteraction<"button"> {
  id = "show_member_to_kick_selection";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;

    const teamId = parseInt(interaction.customId.split(":")[1]!);

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true },
    });

    if (members.length === 0) {
      await interaction.reply({
        content: "This team has no members to kick.",
        components: [],
      });
      return;
    }

    const modalId = uuid4();
    const modal = new ModalBuilder()
      .setTitle("Kick Team Member")
      .setCustomId(modalId)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Select Team member")
          .setStringSelectMenuComponent((builder: StringSelectMenuBuilder) =>
            builder
              .setCustomId("kick_member_selection")
              .setPlaceholder("Select a member to kick")
              .addOptions(
                members.map((member) => ({
                  label: member.user.name,
                  description: `id: ${member.user.id} | role: ${member.role}`,
                  value: member.userId,
                }))
              )
          )
      );

    await interaction.showModal(modal);

    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.customId === modalId && i.user.id === interaction.user.id,
    });
    await modalSubmit.deferReply({ flags: ["Ephemeral"] });
    const memberId = modalSubmit.fields.getStringSelectValues(
      "kick_member_selection"
    )[0];
    if (!memberId) {
      await modalSubmit.editReply({
        content: "No member selected.",
      });
      return;
    }

    try {
      await this.client.teamManageService.kickMember(
        interaction.guild!,
        interaction.user,
        teamId,
        memberId
      );
    } catch (e) {
      if (e instanceof BracketError) {
        await modalSubmit.editReply({
          content: e.message,
          embeds: [],
          components: [],
        });
        return;
      }
      throw e;
    }
    await modalSubmit.editReply({
      content: `<@${memberId}> has been kicked from the team.`,
    });
  }
}
