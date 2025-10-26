import { EmbedBuilder, Interaction } from "discord.js";

import { Event } from "@/base/classes/event";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { RoomDetailsField } from "@/types";

export default class RoomAccessDetailEvent extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  public async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("view_room_details:")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) return;
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
      include: { roomDetail: true },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "Scrim not found.",
      });
      return;
    }

    const teamCaption = await prisma.registeredTeamMember.findFirst({
      where: {
        role: "CAPTAIN",
        userId: interaction.user.id,
        registeredTeam: { scrimId: scrim.id },
      },
      include: {
        registeredTeam: {
          include: {
            assignedSlots: true,
          },
        },
      },
    });

    try {
      await isScrimAdmin(interaction);
    } catch {
      if (!teamCaption) {
        await interaction.editReply({
          content: "You must be a team captain to view room details.",
        });
        return;
      }
      if (teamCaption.registeredTeam.assignedSlots.length == 0) {
        await interaction.editReply({
          content: "Your team has not been assigned a slot yet.",
        });
        return;
      }
    }
    const roomDetail = scrim.roomDetail;
    if (!roomDetail) {
      await interaction.editReply({
        content: "No room details have been set for this scrim.",
      });
      return;
    }
    const fields = roomDetail.fields as RoomDetailsField[];
    if (fields.length === 0) {
      await interaction.editReply({
        content: "No room details have been set for this scrim.",
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setAuthor({
        name: scrim.name ?? "Scrim Match",
      })
      .setTitle("🔑 Room Access Details")
      .setDescription("Below are the credentials to join this scrim match.")
      .addFields(
        fields.map((field) => ({
          name: field.name,
          value: field.value,
          inline: false,
        }))
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
