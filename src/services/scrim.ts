import { Service } from "@/base/classes/service";
import { getFirstAvailableSlot } from "@/database";
import { queue } from "@/lib/bullmq";
import { BRAND_COLOR, SCRIM_REGISTRATION_START } from "@/lib/constants";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { discordTimestamp } from "@/lib/utils";
import { Scrim, Stage, Team } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export class ScrimService extends Service {
  async scheduleRegistrationStart(scrim: Scrim) {
    // Cancel Existing Job if any
    const existingJob = await queue.getJob(
      `${SCRIM_REGISTRATION_START}:${scrim.id}`,
    );
    if (existingJob) {
      await existingJob.remove();
      logger.info(
        `Existing registration open job for scrim ${scrim.id} removed`,
      );
    }
    if (scrim.stage != "CONFIGURATION") {
      logger.warn(
        `Scrim ${scrim.id} is not in configuration stage, skipping scheduling registration start`,
      );
      return;
    }
    const delay = scrim.registrationStartTime.getTime() - Date.now();
    console.log(scrim.registrationStartTime, new Date(), delay);
    if (delay <= 0) {
      logger.info(
        `Registration start time for scrim ${scrim.id} is in the past, opening registration immediately`,
      );
      await this.openRegistration(scrim);
      return;
    }
    await queue.add(
      SCRIM_REGISTRATION_START,
      { scrimId: scrim.id },
      { delay, jobId: `${SCRIM_REGISTRATION_START}:${scrim.id}` },
    );
    logger.info(
      `Registration open job for scrim ${scrim.id} queued to run in ${Math.round(
        delay / 1000,
      )} seconds`,
    );
  }
  async openRegistration(scrim: Scrim) {
    if (scrim.stage == "REGISTRATION") {
      logger.warn(`Scrim ${scrim.id} is already in registration stage`);
      return;
    }

    // Update Scrim Stage to Registration
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { stage: "REGISTRATION" },
    });
    logger.info(`Scrim ${scrim.id} moved to registration stage`);
    await this.updateScrimConfigMessage(scrim);

    const channel = await this.client.channels.fetch(
      scrim.registrationChannelId,
    );
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      logger.error(
        `Registration channel ${scrim.registrationChannelId} not found or not text-based`,
      );
      return;
    }
    // Open Registration Channel For Everyone
    await channel.edit({
      permissionOverwrites: [
        {
          id: scrim.guildId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });

    await channel.send({
      content: `Registration for scrim **${scrim.name}** is now OPEN! Use the \`/register\` command to join.`,
    });
  }

  async closeRegistration(scrim: Scrim) {
    if (scrim.stage != "REGISTRATION") {
      logger.warn(`Scrim ${scrim.id} is not in registration stage`);
      return;
    }
    // Update Scrim Stage to Ongoing
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { stage: "SLOT_ALLOCATION" },
    });
    logger.info(`Scrim ${scrim.id} moved to slot allocation stage`);
    await this.updateScrimConfigMessage(scrim);
    const channel = await this.client.channels.fetch(
      scrim.registrationChannelId,
    );
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      logger.error(
        `Registration channel ${scrim.registrationChannelId} not found or not text-based`,
      );
      return;
    }
    // Close Registration Channel For Everyone
    await channel.edit({
      permissionOverwrites: [
        {
          id: scrim.guildId,
          deny: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });

    await channel.send({
      content: `Registration for scrim **${scrim.name}** is now CLOSED! The staff will now proceed to allocate slots and create teams.`,
    });
  }

  private getScrimConfigComponents(scrim: Scrim) {
    const canConfigure =
      scrim.stage === Stage.CONFIGURATION || scrim.stage === Stage.REGISTRATION;
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`show_team_config_modal:${scrim.id}`)
        .setLabel("Configure Teams")
        .setEmoji("👥")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`show_scrim_timing_config_modal:${scrim.id}`)
        .setLabel("Set Timings")
        .setEmoji("⏱️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`toggle_scrim_slotlist_mode:${scrim.id}`)
        .setLabel(
          scrim.autoSlotList ? "Use Manual Slotlist" : "Use Auto Slotlist",
        )
        .setEmoji(scrim.autoSlotList ? "📝" : "⚡")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`toggle_scrim_registration_auto_close:${scrim.id}`)
        .setLabel(
          scrim.autoCloseRegistration
            ? "Disable Auto-Close"
            : "Enable Auto-Close",
        )
        .setEmoji(scrim.autoCloseRegistration ? "🚫" : "✅")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),
    );

    const startRegistrationButton = new ButtonBuilder()
      .setCustomId(`start_registration:${scrim.id}`)
      .setLabel("Start Registration")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(scrim.stage !== Stage.CONFIGURATION);

    // TODO: Add Pause Registration Button, requires a new stage "PAUSED"

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      startRegistrationButton,
      new ButtonBuilder()
        .setCustomId(`close_registration:${scrim.id}`)
        .setLabel("Close Registration")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(scrim.stage !== Stage.REGISTRATION),
    );
    return [row1, row2];
  }

  private getScrimConfigEmbed(scrim: Scrim) {
    return new EmbedBuilder()
      .setTitle("⚙️ Scrim Configuration")
      .setColor(BRAND_COLOR)
      .setAuthor({
        name: this.client.user?.username || "Scrim Bot",
      })
      .addFields(
        {
          name: "📋 General",
          value: [
            `**Name:** ${scrim.name}`,
            `**Scrim ID:** \`${scrim.id}\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🧑‍🤝‍🧑 Teams",
          value: [
            `**Max Teams:** ${scrim.maxTeams}`,
            `**Players/Team:** ${
              scrim.minPlayersPerTeam && scrim.maxPlayersPerTeam
                ? scrim.minPlayersPerTeam === scrim.maxPlayersPerTeam
                  ? `${scrim.minPlayersPerTeam}`
                  : `${scrim.minPlayersPerTeam}–${scrim.maxPlayersPerTeam}`
                : "Not set"
            }`,
            `**Substitutes/Team:** ${scrim.maxSubstitutePerTeam}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "📅 Registration",
          value: [
            `**Opens:** ${discordTimestamp(scrim.registrationStartTime)}`,
            `**Auto-Close:** ${
              scrim.autoCloseRegistration ? "✅ Enabled" : "❌ Disabled"
            }`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🎯 Slotlist Mode",
          value: scrim.autoSlotList ? "⚡ Auto" : "📝 Manual",
          inline: false,
        },
      )
      .setFooter({
        text: "Configuration locks once the registration opens.",
      })
      .setImage("https://i.postimg.cc/VvyvzgPF/Scrim-Manager.png");
  }

  async updateScrimConfigMessage(scrim: Scrim) {
    const channel = await this.client.channels.fetch(scrim.adminChannelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      logger.error(
        `Admin channel ${scrim.adminChannelId} not found or not text-based`,
      );
      return;
    }
    const updatedScrim = await prisma.scrim.findUnique({
      where: { id: scrim.id },
    });
    if (!updatedScrim) {
      logger.error(`Scrim ${scrim.id} not found`);
      return;
    }

    scrim = updatedScrim;

    const components = this.getScrimConfigComponents(scrim);
    const embed = this.getScrimConfigEmbed(scrim);
    let message = null;

    if (!scrim.adminConfigMessageId) {
      logger.warn(`Scrim ${scrim.id} does not have an admin config message ID`);
    } else {
      message = await channel.messages.fetch(scrim.adminConfigMessageId);
    }
    if (!message) {
      logger.warn(
        `Admin config message ${scrim.adminConfigMessageId} for scrim ${scrim.id} not found, creating a new one`,
      );
      const newMessage = await channel.send({ embeds: [embed], components });
      await prisma.scrim.update({
        where: { id: scrim.id },
        data: { adminConfigMessageId: newMessage.id },
      });
    } else {
      await message.edit({ embeds: [embed], components });
    }
    logger.info(`Scrim ${scrim.id} config message updated`);
  }

  async registrationNeedsClosing(scrim: Scrim) {
    const scrimWithTeamLength = await prisma.scrim.findUnique({
      where: { id: scrim.id },
      include: { _count: { select: { Team: true } } },
    });

    if (!scrimWithTeamLength) {
      logger.error(`Scrim ${scrim.id} not found`);
      return false;
    }

    if (scrim.stage != "REGISTRATION") {
      logger.warn(`Scrim ${scrim.id} is not in registration stage`);
      return false;
    }
    if (!scrim.autoCloseRegistration) {
      logger.info(
        `Scrim ${scrim.id} does not have auto-close registration enabled`,
      );
      return false;
    }
    if (scrimWithTeamLength._count.Team >= scrim.maxTeams) {
      logger.info(
        `Scrim ${scrim.id} has reached max teams (${scrim.maxTeams})`,
      );
      return true;
    }
    return false;
  }
  async unregisterTeam(team: Team) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: team.scrimId },
    });
    if (!scrim) {
      logger.error(`Scrim with ID ${team.scrimId} not found`);
      return;
    }
    const AssignedSlot = await prisma.assignedSlot.findFirst({
      where: {
        teamId: team.id,
        scrimId: team.scrimId,
      },
    });
    if (AssignedSlot) {
      await prisma.assignedSlot.deleteMany({
        where: {
          teamId: team.id,
          scrimId: team.scrimId,
        },
      });
    }

    await prisma.team.update({
      where: {
        id: team.id,
        scrimId: team.scrimId,
      },
      data: {
        registeredAt: null,
        messageId: null,
      },
    });
    try {
      if (!team.messageId) return;
      const channel = await this.client.channels.fetch(
        scrim.participantsChannelId,
      );
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        logger.error(
          `Participants channel ${scrim.participantsChannelId} not found or not text-based`,
        );
        return;
      }
      const message = await channel.messages.fetch(team.messageId);
      if (!message) {
        logger.error(
          `Team message with ID ${team.messageId} not found in channel ${channel.id}`,
        );
        return;
      }
      await message.delete();
    } catch (error) {
      logger.error(`Error deleting team message: ${(error as Error).message}`);
    }
  }
  async assignTeamSlot(team: Team, scrim: Scrim, slotNumber: number = -1) {
    const teamCaptain = await prisma.teamMember.findFirst({
      where: { teamId: team.id, isCaptain: true },
    });
    if (!teamCaptain) {
      logger.error(`Team captain for team ${team.id} not found`);
      return;
    }
    const reservedSlot = await prisma.reservedSlot.findFirst({
      where: { scrimId: scrim.id, userId: teamCaptain.userId },
    });
    const performAutoSlot = scrim.autoSlotList || reservedSlot;
    if (!performAutoSlot) {
      logger.info(
        `Scrim ${scrim.id} is not in auto slotlist mode and team ${team.id} does not have a reserved slot`,
      );
      return;
    }
    if (slotNumber == -1) {
      if (reservedSlot) {
        slotNumber = reservedSlot.slotNumber;
      } else {
        slotNumber = await getFirstAvailableSlot(scrim.id);
      }
    }

    if (slotNumber === -1) {
      logger.warn(`No available slots for scrim ${scrim.id}`);
      return;
    }
    const assignedSlot = await prisma.assignedSlot.create({
      data: { scrimId: scrim.id, teamId: team.id, slotNumber },
    });
    return assignedSlot;
  }
}
