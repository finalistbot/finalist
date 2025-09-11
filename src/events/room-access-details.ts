import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
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
    // FIXME: Only show room details to participants of the scrim
    const roomDetail = scrim.RoomDetail;
    const fields = roomDetail?.fields as Record<string, string>;
    if (!roomDetail || Object.keys(fields).length === 0) {
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
        ...Object.entries(fields).map(([key, value]) => ({
          name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), // format keys
          value: `\`${value}\``, // put in code block for clarity
          inline: true,
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
