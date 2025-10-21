import { Service } from "@/base/classes/service";
import { BRAND_COLOR } from "@/lib/constants";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { discordTimestamp } from "@/lib/utils";
import { Scrim, Stage, Tournament } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export default class TournamentService extends Service {
  private getTournamentConfigComponents(tournament: Tournament) {
    const canConfigure = true;

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_general:${tournament.id}`)
        .setLabel("General")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canConfigure),
      new ButtonBuilder()
        .setCustomId(`edit_teams:${tournament.id}`)
        .setLabel("Teams")
        .setEmoji("🧑‍🤝‍🧑")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canConfigure),
      new ButtonBuilder()
        .setCustomId(`edit_registration:${tournament.id}`)
        .setLabel("Registration")
        .setEmoji("📅")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canConfigure)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_slotlist:${tournament.id}`)
        .setLabel("Slotlist Mode")
        .setEmoji("🎯")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),
      new ButtonBuilder()
        .setCustomId(`edit_prizepool:${tournament.id}`)
        .setLabel("Prize Pool")
        .setEmoji("💰")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),
      new ButtonBuilder()
        .setCustomId(`edit_rules:${tournament.id}`)
        .setLabel("Rules")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_channels:${tournament.id}`)
        .setLabel("Channels")
        .setEmoji("📡")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),
      new ButtonBuilder()
        .setCustomId(`refresh_tournament_embed:${tournament.id}`)
        .setLabel("Refresh")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`delete_tournament:${tournament.id}`)
        .setLabel("Delete")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!canConfigure)
    );

    return [row1, row2, row3];
  }

  private async getTournamentConfigEmbed(tournament: Tournament) {
    return new EmbedBuilder()
      .setTitle("🏆 Tournament Configuration")
      .setColor(BRAND_COLOR)
      .setAuthor({
        name: this.client.user?.username || "Tournament Bot",
      })
      .addFields(
        {
          name: "📋 General",
          value: [
            `**Name:** ${tournament.name}`,
            `**Tournament ID:** \`${tournament.id}\``,
            `**Bracket Type:** ${tournament.bracketType.replaceAll("_", " ")}`,
            `**Stage:** ${tournament.stage}`,
            tournament.description
              ? `**Description:** ${tournament.description}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          inline: false,
        },
        {
          name: "🧑‍🤝‍🧑 Teams",
          value: [
            `**Max Teams:** ${tournament.maxTeams}`,
            `**Players/Team:** ${
              tournament.minPlayersPerTeam === tournament.maxPlayersPerTeam
                ? `${tournament.maxPlayersPerTeam}`
                : `${tournament.minPlayersPerTeam}–${tournament.maxPlayersPerTeam}`
            }`,
            `**Substitutes/Team:** ${tournament.maxSubstitutePerTeam}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "📅 Registration",
          value: [
            `**Opens:** ${discordTimestamp(tournament.registrationStartTime)}`,
            `**Auto-Close:** ${
              tournament.autoCloseRegistration ? "✅ Enabled" : "❌ Disabled"
            }`,
            tournament.registrationEndedTime
              ? `**Ends:** ${discordTimestamp(tournament.registrationEndedTime)}`
              : "⏳ No end time set",
          ].join("\n"),
          inline: false,
        },
        {
          name: "🎯 Slotlist Mode",
          value: tournament.autoSlotList ? "⚡ Auto" : "📝 Manual",
          inline: false,
        },
        {
          name: "💰 Prize Pool",
          value: tournament.prizePool
            ? `₹${tournament.prizePool.toLocaleString()}`
            : "❌ Not set",
          inline: false,
        },
        {
          name: "📜 Rules",
          value: tournament.rules ? tournament.rules : "❌ No rules provided",
          inline: false,
        },
        {
          name: "📡 Channels",
          value: [
            `**Registration:** <#${tournament.registrationChannelId}>`,
            `**Logs:** <#${tournament.logsChannelId}>`,
            `**Results:** <#${tournament.resultsChannelId}>`,
            `**Participants:** <#${tournament.participantsChannelId}>`,
            `**Admin:** <#${tournament.adminChannelId}>`,
            `**Bracket:** <#${tournament.bracketChannelId}>`,
          ].join("\n"),
          inline: false,
        }
      )
      .setFooter({
        text: "Tournament configuration will lock once registration starts.",
      })
      .setImage("https://i.postimg.cc/0QDC8KvN/Tournament-Manager.png");
  }

  async updateTournamentConfigMessage(tournament: Tournament) {
    const channel = await this.client.channels.fetch(tournament.adminChannelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      logger.error(
        `Admin channel ${tournament.adminChannelId} not found or not text-based`
      );
      return;
    }
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournament.id },
    });
    if (!updatedTournament) {
      logger.error(`Tournament ${tournament.id} not found`);
      return;
    }

    tournament = updatedTournament;
    const embed = await this.getTournamentConfigEmbed(tournament);
    const components = this.getTournamentConfigComponents(tournament);
    let message = null;
    if (!tournament.adminConfigMessageId) {
      logger.warn(
        `Tournament ${tournament.id} does not have an admin config message ID`
      );
    } else {
      try {
        message = await channel.messages.fetch(tournament.adminConfigMessageId);
      } catch (error) {
        logger.error(
          `Failed to fetch admin config message ${tournament.adminConfigMessageId} for tournament ${tournament.id}: ${(error as Error).message}`
        );
        message = null;
      }
    }
    if (!message) {
      logger.warn(
        `Admin config message ${tournament.adminConfigMessageId} for tournament ${tournament.id} not found, creating a new one`
      );
      const newMessage = await channel.send({
        embeds: [embed],
        components: components,
      });
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { adminConfigMessageId: newMessage.id },
      });
    } else {
      await message.edit({ embeds: [embed], components: components });
    }
    logger.info(`Tournament ${tournament.id} config message updated`);
  }
}
