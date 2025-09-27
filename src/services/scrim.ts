import { BracketError } from "@/base/classes/error";
import { Service } from "@/base/classes/service";
import { slotsToTable } from "@/commands/esports/slotlist";
import { getFirstAvailableSlot } from "@/database";
import { queue } from "@/lib/bullmq";
import { BRAND_COLOR, SCRIM_REGISTRATION_START } from "@/lib/constants";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { discordTimestamp } from "@/lib/utils";
import { editTeamDetails } from "@/ui/messages/teams";
import { Scrim, Stage, Team } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
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
      throw new BracketError("Scrim is already in registration stage.");
    }

    let channel;
    try {
      channel = (await this.client.channels.fetch(
        scrim.registrationChannelId,
      )) as TextChannel;
    } catch (error) {
      logger.error(
        `Failed to fetch registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`,
      );
      throw new BracketError(
        `Can't find registration channel <#${scrim.registrationChannelId}>. Maybe it was deleted?`,
      );
    }

    try {
      await channel.permissionOverwrites.edit(scrim.guildId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    } catch (error) {
      logger.error(
        `Failed to update permissions for registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`,
      );
      throw new BracketError(
        `Can't update permissions for registration channel <#${scrim.registrationChannelId}>. Maybe I don't have permission to do so?`,
      );
    }

    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { stage: "REGISTRATION" },
    });
    logger.info(`Scrim ${scrim.id} moved to registration stage`);
    await this.updateScrimConfigMessage(scrim);

    this.client.eventLogger.logEvent("registrationChannelOpened", {
      channelId: channel.id,
      trigger: { type: "system" },
    });

    try {
      await channel.send({
        content: `Registration for scrim **${scrim.name}** is now OPEN! Use the \`/register\` command to join.`,
      });
    } catch (error) {
      logger.error(
        `Failed to send registration open message in channel <#${scrim.registrationChannelId}> for scrim ${scrim.id}: ${(error as Error).message}`,
      );
    }
  }
  async closeRegistration(scrim: Scrim) {
    if (scrim.stage != "REGISTRATION") {
      logger.warn(`Scrim ${scrim.id} is not in registration stage`);
      throw new BracketError("Scrim is not in registration stage.");
    }
    // Update Scrim Stageto Ongoing
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { stage: "SLOT_ALLOCATION" },
    });
    logger.info(`Scrim ${scrim.id} moved to slot allocation stage`);
    await this.updateScrimConfigMessage(scrim);
    let channel;
    try {
      channel = (await this.client.channels.fetch(
        scrim.registrationChannelId,
      )) as TextChannel;
    } catch (error) {
      logger.error(
        `Failed to fetch registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`,
      );
      throw new BracketError(
        `Can't find registration channel <#${scrim.registrationChannelId}>. Maybe it was deleted? or I don't have access to it.`,
      );
    }
    try {
      await channel.permissionOverwrites.edit(scrim.guildId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      });
    } catch (error) {
      logger.error(
        `Failed to update permissions for registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`,
      );
      throw new BracketError(
        `Can't update permissions for registration channel ${scrim.registrationChannelId}. Maybe I don't have permission to do so?`,
      );
    }

    this.client.eventLogger.logEvent("registrationClosed", {
      scrim,
    });

    try {
      await channel.send({
        content: `Registration for scrim **${scrim.name}** is now CLOSED! The staff will now proceed to allocate slots and create teams.`,
      });
    } catch (error) {
      logger.error(
        `Failed to send registration close message in channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`,
      );
    }
    if (scrim.autoSlotList) {
      const slots = await prisma.assignedSlot.findMany({
        where: { scrimId: scrim.id },
        include: { team: true },
      });
      const details = [];
      for (const slot of slots) {
        const slotDetails = {
          slotNumber: slot.slotNumber,
          teamName: slot.team.name,
          teamId: slot.team.id,
          jumpUrl: `https://discord.com/channels/${scrim.guildId}/${scrim.participantsChannelId}/${slot.team.messageId}`,
        };
        details.push(slotDetails);
      }
      const table = slotsToTable(details);

      const registerChannel = (await this.client.channels.fetch(
        scrim.registrationChannelId,
      )) as TextChannel;
      const logsChannel = (await this.client.channels.fetch(
        scrim.logsChannelId,
      )) as TextChannel;
      if (!registerChannel?.isTextBased() && !logsChannel?.isTextBased()) {
        logger.error(
          `Registration channel ${scrim.registrationChannelId} or participants channel ${scrim.participantsChannelId} not found or not text-based for scrim ${scrim.id}`,
        );
        return;
      }
      try {
        await registerChannel.send({
          content: "Here is the final slotlist:",
          files: [
            {
              attachment: Buffer.from(table, "utf-8"),
              name: "Slotlist.txt",
            },
          ],
        });
        await logsChannel.send({
          content: "Here is the final slotlist:",
          files: [
            {
              attachment: Buffer.from(table, "utf-8"),
              name: "Slotlist.txt",
            },
          ],
        });
      } catch (error) {
        logger.error(
          `Failed to send slotlist embed in channel ${scrim.registrationChannelId} or ${scrim.participantsChannelId} for scrim ${scrim.id}: ${
            (error as Error).message
          }`,
        );
      }
    }
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
            `**Require In-Game Names:** ${scrim.requireIngameNames ? "✅ Yes" : "❌ No"}`,
            `**Captain Add Members:** ${
              scrim.captainAddMembers ? "✅ Yes" : "❌ No"
            }`,
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
      try {
        message = await channel.messages.fetch(scrim.adminConfigMessageId);
      } catch (error) {
        logger.error(
          `Failed to fetch admin config message ${scrim.adminConfigMessageId} for scrim ${scrim.id}: ${(error as Error).message}`,
        );
        message = null;
      }
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
    await this.removeTeamSlot(scrim, team);
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

  async assignTeamSlot(
    scrim: Scrim,
    team: Team,
    slotNumber: number = -1,
    force: boolean = false,
  ) {
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
    const performAutoSlot =
      scrim.autoSlotList || reservedSlot || slotNumber != -1 || force;
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
    if (assignedSlot) {
      this.client.rolemanageService.addParticipantRoleToTeam(team);
      this.client.eventLogger.logEvent("slotAssigned", {
        team,
        assignedSlot,
        trigger: { type: "system" },
      });
    }
    return assignedSlot;
  }

  async removeTeamSlot(scrim: Scrim, team: Team) {
    const assigned = await prisma.assignedSlot.findFirst({
      where: { scrimId: scrim.id, teamId: team.id },
    });
    if (!assigned) {
      logger.warn(
        `Team ${team.id} does not have an assigned slot in scrim ${scrim.id}`,
      );
      return;
    }
    await prisma.assignedSlot.deleteMany({
      where: { scrimId: scrim.id, teamId: team.id },
    });
    this.client.rolemanageService.removeParticipantRoleFromTeam(team);
    this.client.eventLogger.logEvent("slotUnassigned", {
      team,
      unassignedSlot: assigned,
      trigger: { type: "system" },
    });
    return assigned;
  }

  async fillSlotList(scrim: Scrim, type: "normal" | "random" = "normal") {
    let teams = await prisma.team.findMany({
      where: {
        scrimId: scrim.id,
        registeredAt: { not: null },
        AssignedSlot: { none: {} },
      },
      orderBy: { registeredAt: "asc" },
    });

    if (type === "random") {
      teams = teams.sort(() => Math.random() - 0.5);
    }

    const takenSlotCount = await prisma.assignedSlot.count({
      where: { scrimId: scrim.id },
    });

    const availableSlots = scrim.maxTeams - takenSlotCount;
    if (availableSlots <= 0) {
      logger.info(`No available slots to fill for scrim ${scrim.id}`);
      return;
    }
    teams = teams.slice(0, availableSlots);

    for (const team of teams) {
      await this.assignTeamSlot(scrim, team, -1, true);
      editTeamDetails(scrim, team, this.client);
    }
  }
}
