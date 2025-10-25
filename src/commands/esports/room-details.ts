import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { Command } from "@/base/classes/command";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { convertToSlug, convertToTitleCase, safeRunChecks } from "@/lib/utils";
import { RoomDetailsField } from "@/types";
import { CommandInfo } from "@/types/command";

export default class RoomDetailCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("rd")
    .setDescription("Manage room access details for the current match.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set the room access details for the current match.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the field.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("value")
            .setDescription("The value of the field.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("post")
        .setDescription("Post the room access details.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to post the details in.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear")
        .setDescription("Clear the room access details for the current match.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the field to clear.")
            .setRequired(false)
        )
    );
  info: CommandInfo = {
    name: "rd",
    description: "Manage room access details for the current match.",
    category: "Esports",
    longDescription:
      "Manage room access details for the current match. You can set, post, and clear room access details.",
    usageExamples: [
      "/rd set game:CS:GO",
      "/rd set id:123456",
      "/rd set name:Password value:abc123",
      "/rd post channel:#general",
      "/rd clear name:Password",
      "/rd clear",
    ],
    subcommands: [
      {
        name: "set",
        description: "Set the room access details for the current match.",
        options: [
          {
            name: "name",
            description: "The name of the field.",
            type: "STRING",
            required: true,
          },
          {
            name: "value",
            description: "The value of the field.",
            type: "STRING",
            required: true,
          },
        ],
      },
      {
        name: "post",
        description: "Post the room access details.",
        options: [
          {
            name: "channel",
            description: "The channel to post the details in.",
            type: "CHANNEL",
            required: true,
          },
        ],
      },
      {
        name: "clear",
        description: "Clear the room access details for the current match.",
        options: [
          {
            name: "name",
            description: "The name of the field to clear.",
            type: "STRING",
            required: false,
          },
        ],
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "set") {
      await this.setRd(interaction);
    } else if (subcommand === "post") {
      await this.postRd(interaction);
    } else if (subcommand === "clear") {
      await this.clearRd(interaction);
    } else {
      await interaction.editReply({
        content: "Unknown subcommand.",
      });
    }
  }

  private async setRd(interaction: ChatInputCommandInteraction<"cached">) {
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        roomDetail: true,
      },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    let roomDetail = scrim.roomDetail;
    if (!roomDetail) {
      roomDetail = await prisma.roomDetail.create({
        data: {
          scrimId: scrim.id,
          fields: [],
        },
      });
    }
    let name = interaction.options.getString("name", true);
    name = convertToTitleCase(name);
    const slug = convertToSlug(name);
    const value = interaction.options.getString("value", true);
    const fields = roomDetail.fields as RoomDetailsField[];
    const existingFieldIndex = fields.findIndex((f) => f.slug === slug);
    if (existingFieldIndex !== -1) {
      fields[existingFieldIndex] = { name, value, slug };
    } else {
      fields.push({ name, value, slug });
    }
    roomDetail = await prisma.roomDetail.update({
      where: {
        id: roomDetail.id,
      },
      data: {
        fields,
      },
    });
    await interaction.editReply({
      content: `Set field \`${name}\` to \`${value}\`.`,
    });
  }

  private async postRd(interaction: ChatInputCommandInteraction<"cached">) {
    const channel = interaction.options.getChannel("channel", true);
    if (!channel.isTextBased()) {
      await interaction.editReply({
        content: "Please select a text-based channel.",
      });
      return;
    }
    // Check channel permissions
    const botMember = await channel.guild.members.fetchMe();
    const botPermissions = channel.permissionsFor(botMember);
    if (
      !botPermissions ||
      !botPermissions.has("EmbedLinks") ||
      !botPermissions.has("ViewChannel") ||
      !botPermissions.has("SendMessages") ||
      !botPermissions.has("ReadMessageHistory") ||
      !botPermissions.has("UseExternalEmojis") ||
      !botPermissions.has("AddReactions")
    ) {
      await interaction.reply({
        content: `I don't have permission to send messages in ${channel}. Please ensure I have the following permissions: View Channel, Send Messages, Read Message History, Embed Links, Use External Emojis, Add Reactions.`,
      });
      return;
    }
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        roomDetail: true,
      },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
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
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("View Room Details")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔑")
        .setCustomId("view_room_details:" + scrim.id)
    );

    const embed = new EmbedBuilder()
      .setTitle(`Room Access Details for ${scrim.name}`)
      .setColor(BRAND_COLOR)
      .setDescription("Click the button below to view room access details.");

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      content: `Posted room details in ${channel}.`,
    });
  }

  private async clearRd(interaction: ChatInputCommandInteraction<"cached">) {
    const name = interaction.options.getString("name", false);
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        roomDetail: true,
      },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    const roomDetail = scrim.roomDetail;
    if (!roomDetail) {
      await interaction.editReply({
        content: "No room details have been set for this scrim.",
      });
      return;
    }
    if (!name) {
      await prisma.roomDetail.update({
        where: {
          id: roomDetail.id,
        },
        data: {
          fields: [],
        },
      });
      await interaction.editReply({
        content: "Cleared all room details.",
      });
      return;
    }
    const fields = roomDetail.fields as RoomDetailsField[];
    const slug = convertToSlug(name);
    const fieldIdx = fields.findIndex((f) => f.slug === slug);
    if (fieldIdx === -1) {
      await interaction.editReply({
        content: `Field \`${name}\` does not exist.`,
      });
      return;
    }
    fields.splice(fieldIdx, 1);
    await prisma.roomDetail.update({
      where: {
        id: roomDetail.id,
      },
      data: {
        fields,
      },
    });
    await interaction.editReply({
      content: `Cleared field \`${name}\`.`,
    });
  }
}
