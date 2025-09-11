import { Command } from "@/base/classes/command";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { ConvertToTitleCase } from "@/lib/utils";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
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
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "set") {
      await this.setRd(interaction);
    } else if (subcommand === "post") {
      await this.postRd(interaction);
    } else if (subcommand === "clear") {
      await this.clearRd(interaction);
    } else {
      await interaction.reply({
        content: "Unknown subcommand.",
        ephemeral: true,
      });
    }
  }

  private async setRd(interaction: ChatInputCommandInteraction<"cached">) {
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        RoomDetail: true,
      },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This command can only be used in a scrim admin channel.",
        ephemeral: true,
      });
      return;
    }
    let roomDetail = scrim.RoomDetail;
    if (!roomDetail) {
      roomDetail = await prisma.roomDetail.create({
        data: {
          scrimId: scrim.id,
        },
      });
    }
    const name = ConvertToTitleCase(
      interaction.options.getString("name", true)
    );
    const value = interaction.options.getString("value", true);
    const fields = roomDetail.fields as Record<string, string>;

    fields[name] = value;
    roomDetail = await prisma.roomDetail.update({
      where: {
        id: roomDetail.id,
      },
      data: {
        fields,
      },
    });
    await interaction.reply({
      content: `Set field \`${name}\` to \`${value}\`.`,
      flags: "Ephemeral",
    });
  }

  private async postRd(interaction: ChatInputCommandInteraction<"cached">) {
    const channel = interaction.options.getChannel("channel", true);
    if (!channel.isTextBased()) {
      await interaction.reply({
        content: "Please select a text-based channel.",
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        RoomDetail: true,
      },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }

    const roomDetail = scrim.RoomDetail;
    if (!roomDetail) {
      await interaction.editReply({
        content: "No room details have been set for this scrim.",
      });
      return;
    }
    const fields = roomDetail.fields as Record<string, string>;
    if (Object.keys(fields).length === 0) {
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
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        RoomDetail: true,
      },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    const roomDetail = scrim.RoomDetail;
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
          fields: {},
        },
      });
      await interaction.editReply({
        content: "Cleared all room details.",
      });
      return;
    }
    const fields = roomDetail.fields as Record<string, string>;
    if (!(name in fields)) {
      await interaction.editReply({
        content: `Field \`${name}\` does not exist.`,
      });
      return;
    }
    delete fields[name];
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
