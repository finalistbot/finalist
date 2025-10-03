import { Command } from "@/base/classes/command";
import { BRAND_COLOR } from "@/lib/constants";
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
    const channel = interaction.options.getChannel("channel", true);
    if (!channel.isTextBased()) {
      await interaction.reply({
        content: "Please select a text-based channel.",
        ephemeral: true,
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
    const embed = new EmbedBuilder()
      .setTitle("Team Portal")
      .setDescription(
        "Welcome to the Team Portal! Here you can create and manage your teams for various esports tournaments and events. Use the buttons below to get started."
      )
      .setColor(BRAND_COLOR);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Create Team")
        .setStyle(ButtonStyle.Success)
        .setCustomId(`show_create_team_modal`),
      new ButtonBuilder()
        .setLabel("Manage Teams")
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`show_manage_teams`),
      new ButtonBuilder()
        .setLabel("Join Team")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`show_join_team_model`)
    );
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      content: `Team portal has been sent to ${channel}.`,
    });
  }
}
