import { Command } from "@/base/classes/command";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { BRAND_COLOR, ImageUrl, ThumbnailUrl } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export default class TeamPortalCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("teamportal")
    .setDescription("Send the team portal to a channel")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to post the team portal")
        .setRequired(true)
        .addChannelTypes(0, 5)
    );
  info: CommandInfo = {
    name: "teamportal",
    description: "Send the team portal to a channel.",
    longDescription:
      "Sends an interactive team portal message to the specified channel, allowing users to create and manage teams easily.",
    usageExamples: ["/teamportal channel:#team-portal"],
    category: "Esports",
    options: [
      {
        name: "channel",
        description: "Channel to post the team portal",
        type: "CHANNEL",
        required: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const isAdmin = await suppress(isScrimAdmin(interaction), false);
    if (!isAdmin) {
      await interaction.reply({
        content: "You do not have permission to use this command.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const channel = interaction.options.getChannel("channel", true);
    if (!channel.isTextBased()) {
      await interaction.reply({
        content: "Please select a text-based channel.",
        flags: ["Ephemeral"],
      });
      return;
    }
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

    const data = await prisma.guildConfig.findFirst({
      where: { id: interaction.guildId },
    });

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle("🏆 Team Portal")
      .setDescription(
        [
          "Welcome to the **Team Portal**!",
          "",
          "Here you can create and manage your teams for upcoming **esports tournaments** and **events**.",
          "",
          "✨ Use the buttons below to get started:",
          "- ➕ Create a new team",
          "- 👥 Manage your existing team",
          "- 🔍 Join an available team",
        ].join("\n")
      )
      .setImage(data?.bannerUrl || ImageUrl)
      .setThumbnail(data?.logoUrl || ThumbnailUrl)
      .setFooter({ text: "Powered by Finalist" })
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Create Team")
        .setStyle(ButtonStyle.Success)
        .setCustomId(`show_create_team_modal`),
      new ButtonBuilder()
        .setLabel("Manage Teams")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`show_manage_team_options`),
      new ButtonBuilder()
        .setLabel("Join Team")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`show_join_team_modal`)
    );
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      content: `Team portal has been sent to ${channel}.`,
    });
  }
}
