import { Event } from "@/base/classes/event";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { RoomDetailsField } from "@/types";
import { EmbedBuilder, Interaction } from "discord.js";
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
      include: { RoomDetail: true },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "Scrim not found.",
      });
      return;
    }

    const teamCaption = await prisma.teamMember.findFirst({
      where: {
        isCaptain: true,
        userId: interaction.user.id,
        team: { scrimId: scrim.id },
      },
      include: {
        team: {
          include: {
            AssignedSlot: true,
          },
        },
      },
    });

    try {
      await checkIsScrimAdmin(interaction);
    } catch {
      if (!teamCaption) {
        await interaction.editReply({
          content: "You must be a team captain to view room details.",
        });
        return;
      }
      if (teamCaption.team.AssignedSlot.length == 0) {
        await interaction.editReply({
          content: "Your team has not been assigned a slot yet.",
        });
        return;
      }
    }
    const roomDetail = scrim.RoomDetail;
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
        })),
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
