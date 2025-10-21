import { BracketError } from "@/base/classes/error";
import { Service } from "@/base/classes/service";
import { slotsToTable } from "@/commands/esports/slotlist";
import { getFirstAvailableSlot } from "@/database";
import { queue } from "@/lib/bullmq";
import {
  BRAND_COLOR,
  DAYS_OF_WEEK,
  SCRIM_AUTO_CLEAN,
  SCRIM_REGISTRATION_START,
} from "@/lib/constants";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { discordTimestamp, suppress } from "@/lib/utils";
import { editRegisteredTeamDetails } from "@/ui/messages/teams";
import { RegisteredTeam, Scrim, Stage, Team, Tournament } from "@prisma/client";
import * as dateFns from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
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
      `${SCRIM_REGISTRATION_START}:${scrim.id}`
    );
    if (existingJob) {
      try {
        await existingJob.remove();
      } catch {}
      logger.info(
        `Existing registration open job for scrim ${scrim.id} removed`
      );
    }
    if (scrim.stage != "IDLE") {
      logger.warn(
        `Scrim ${scrim.id} is not in configuration stage, skipping scheduling registration start`
      );
      return;
    }
    const delay = scrim.registrationStartTime.getTime() - Date.now();
    if (delay <= 0) {
      logger.info(
        `Registration start time for scrim ${scrim.id} is in the past, opening registration immediately`
      );
      await this.openRegistration(scrim);
      return;
    }
    await queue.add(
      SCRIM_REGISTRATION_START,
      { scrimId: scrim.id },
      { delay, jobId: `${SCRIM_REGISTRATION_START}:${scrim.id}` }
    );
    logger.info(
      `Registration open job for scrim ${scrim.id} queued to run in ${Math.round(
        delay / 1000
      )} seconds`
    );
  }
  async scheduleAutoCleanup(scrim: Scrim) {
    const job = await queue.getJob(`${SCRIM_AUTO_CLEAN}:${scrim.id}`);
    if (job) {
      try {
        await job.remove();
      } catch {}
      logger.info(`Existing auto-clean job for scrim ${scrim.id} removed`);
    }
    const autocleanTime = scrim.autocleanTime;
    if (!autocleanTime) {
      logger.info(
        `Scrim ${scrim.id} does not have auto-clean time set, skipping scheduling auto-clean`
      );
      return;
    }
    const now = new Date();
    const cleanHour = autocleanTime.getHours();
    const cleanMinute = autocleanTime.getMinutes();
    let target = dateFns.set(now, {
      hours: cleanHour,
      minutes: cleanMinute,
      seconds: 0,
      milliseconds: 0,
    });
    if (dateFns.isBefore(target, now)) {
      target = dateFns.addDays(target, 1);
    }
    let difference = target.getTime() - now.getTime();
    await queue.add(
      SCRIM_AUTO_CLEAN,
      { scrimId: scrim.id },
      { delay: difference, jobId: `${SCRIM_AUTO_CLEAN}:${scrim.id}` }
    );
    logger.info(
      `Auto-clean job for scrim ${scrim.id} queued to run in ${Math.round(difference / 1000)} seconds`
    );
  }

  async autoClean(scrim: Scrim) {
    const guild = await this.client.guilds.fetch(scrim.guildId);
    if (!guild) {
      logger.error(`Guild ${scrim.guildId} not found for scrim ${scrim.id}`);
      return;
    }

    const channelIds = [
      scrim.logsChannelId,
      scrim.participantsChannelId,
      scrim.registrationChannelId,
    ];
    try {
      for (const id of channelIds) {
        if (!id) continue;
        const channel = await this.client.channels.fetch(id);

        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
          continue;
        }

        let fetched;
        do {
          fetched = await channel.messages.fetch({ limit: 100 });
          if (fetched.size === 0) break;
          await channel.bulkDelete(fetched, true);
        } while (fetched.size > 0);
      }
    } catch (error) {
      logger.error(
        `Error during auto-clean for scrim ${scrim.id}: ${(error as Error).message}`
      );
    }

    try {
      const teams = await prisma.assignedSlot.findMany({
        where: { scrimId: scrim.id },
      });
      for (const team of teams) {
        if (!team.registeredTeamId) continue;

        await this.client.rolemanageService.removeParticipantRoleFromTeam(team);
      }
    } catch (error) {
      logger.error(
        `Error removing participant roles during auto-clean for scrim ${scrim.id}: ${(error as Error).message}`
      );
    }
  }

  async openRegistration(scrim: Scrim) {
    if (scrim.stage == "REGISTRATION") {
      logger.warn(`Scrim ${scrim.id} is already in registration stage`);
      throw new BracketError("Scrim is already in registration stage.");
    }
    await this.scheduleAutoCleanup(scrim);

    // Clear all older teams/slots if any
    await prisma.registeredTeam.deleteMany({
      where: { scrimId: scrim.id },
    });

    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: scrim.guildId },
    });

    let timezone = guildConfig?.timezone || "UTC";

    const zonedDate = toZonedTime(new Date(), timezone);
    const dayOfWeek = dateFns.getDay(zonedDate);
    let daysToAdd = 1;
    if (scrim.openDays.length > 0) {
      while (true) {
        const checkDay = (dayOfWeek + daysToAdd) % 7;
        if (scrim.openDays.includes(checkDay)) {
          break;
        }
        daysToAdd++;
      }
    }
    if (daysToAdd > 0) {
      let registrationStartTime = fromZonedTime(
        dateFns.addDays(zonedDate, daysToAdd),
        timezone
      );
      scrim = await prisma.scrim.update({
        where: { id: scrim.id },
        data: {
          registrationStartTime,
        },
      });
      await this.scheduleRegistrationStart(scrim);
    }

    let channel;
    try {
      channel = (await this.client.channels.fetch(
        scrim.registrationChannelId
      )) as TextChannel;
    } catch (error) {
      logger.error(
        `Failed to fetch registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`
      );
      throw new BracketError(
        `Can't find registration channel <#${scrim.registrationChannelId}>. Maybe it was deleted?`
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
        `Failed to update permissions for registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`
      );
      throw new BracketError(
        `Can't update permissions for registration channel <#${scrim.registrationChannelId}>. Maybe I don't have permission to do so?`
      );
    }

    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { stage: "REGISTRATION", registrationEndedTime: null },
    });
    logger.info(`Scrim ${scrim.id} moved to registration stage`);
    await this.updateScrimConfigMessage(scrim);

    this.client.eventLogger.logEvent("registrationChannelOpened", {
      channelId: channel.id,
      trigger: { type: "system" },
    });

    try {
      await channel.send({
        content: `Registration for scrim **${scrim.name}** is now OPEN! Use the \`/registerteam\` command to join.`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("Register Team")
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`show_registration_select_menu`)
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to send registration open message in channel <#${scrim.registrationChannelId}> for scrim ${scrim.id}: ${(error as Error).message}`
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
      data: { stage: "CLOSED" },
    });
    logger.info(`Scrim ${scrim.id} moved to slot allocation stage`);
    await this.updateScrimConfigMessage(scrim);
    let channel;
    try {
      channel = (await this.client.channels.fetch(
        scrim.registrationChannelId
      )) as TextChannel;
    } catch (error) {
      logger.error(
        `Failed to fetch registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`
      );
      throw new BracketError(
        `Can't find registration channel <#${scrim.registrationChannelId}>. Maybe it was deleted? or I don't have access to it.`
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
        `Failed to update permissions for registration channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`
      );
      throw new BracketError(
        `Can't update permissions for registration channel ${scrim.registrationChannelId}. Maybe I don't have permission to do so?`
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
        `Failed to send registration close message in channel ${scrim.registrationChannelId} for scrim ${scrim.id}: ${(error as Error).message}`
      );
    }
    if (scrim.autoSlotList) {
      const slots = await prisma.assignedSlot.findMany({
        where: { scrimId: scrim.id },
        include: { registeredTeam: true },
      });
      const details = [];
      for (const slot of slots) {
        const slotDetails = {
          slotNumber: slot.slotNumber,
          teamName: slot.registeredTeam.name,
          teamId: slot.registeredTeam.id,
          jumpUrl: slot.registeredTeam.messageId
            ? `https://discord.com/channels/${scrim.guildId}/${scrim.participantsChannelId}/${slot.registeredTeam.messageId}`
            : "N/A",
        };
        details.push(slotDetails);
      }
      const table = slotsToTable(details);

      const registerChannel = (await this.client.channels.fetch(
        scrim.registrationChannelId
      )) as TextChannel;
      const logsChannel = (await this.client.channels.fetch(
        scrim.logsChannelId
      )) as TextChannel;
      if (!registerChannel?.isTextBased() && !logsChannel?.isTextBased()) {
        logger.error(
          `Registration channel ${scrim.registrationChannelId} or participants channel ${scrim.participantsChannelId} not found or not text-based for scrim ${scrim.id}`
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
          }`
        );
      }
    }
  }
  private getScrimConfigComponents(scrim: Scrim) {
    const canConfigure = true;
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
          scrim.autoSlotList ? "Use Manual Slotlist" : "Use Auto Slotlist"
        )
        .setEmoji(scrim.autoSlotList ? "📝" : "⚡")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`toggle_scrim_registration_auto_close:${scrim.id}`)
        .setLabel(
          scrim.autoCloseRegistration
            ? "Disable Auto-Close"
            : "Enable Auto-Close"
        )
        .setEmoji(scrim.autoCloseRegistration ? "🚫" : "✅")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure),

      new ButtonBuilder()
        .setCustomId(`open_days_config_show:${scrim.id}`)
        .setLabel("Set Open Days")
        .setEmoji("📅")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canConfigure)
    );

    const startRegistrationButton = new ButtonBuilder()
      .setCustomId(`start_registration:${scrim.id}`)
      .setLabel("Start Registration")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(scrim.stage == Stage.REGISTRATION);

    // TODO: Add Pause Registration Button, requires a new stage "PAUSED"

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      startRegistrationButton,
      new ButtonBuilder()
        .setCustomId(`close_registration:${scrim.id}`)
        .setLabel("Close Registration")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(scrim.stage !== Stage.REGISTRATION)
    );
    return [row1, row2];
  }

  private async getScrimConfigEmbed(scrim: Scrim) {
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: scrim.guildId },
    });
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
            "**Open Days:** " +
              (scrim.openDays.length > 0
                ? scrim.openDays
                    .sort((a, b) => a - b)
                    .map((d) => DAYS_OF_WEEK[d])
                    .join(", ")
                : "Only once"),
          ].join("\n"),
          inline: false,
        },
        {
          name: "🎯 Slotlist Mode",
          value: scrim.autoSlotList ? "⚡ Auto" : "📝 Manual",
          inline: false,
        },
        {
          name: "🧹 Auto-Clean",
          value: scrim.autocleanTime
            ? `Daily at ${dateFns.format(
                toZonedTime(
                  scrim.autocleanTime,
                  guildConfig?.timezone || "UTC"
                ),
                "HH:mm"
              )}`
            : "❌ Disabled",
          inline: false,
        }
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
        `Admin channel ${scrim.adminChannelId} not found or not text-based`
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
    const embed = await this.getScrimConfigEmbed(scrim);
    let message = null;

    if (!scrim.adminConfigMessageId) {
      logger.warn(`Scrim ${scrim.id} does not have an admin config message ID`);
    } else {
      try {
        message = await channel.messages.fetch(scrim.adminConfigMessageId);
      } catch (error) {
        logger.error(
          `Failed to fetch admin config message ${scrim.adminConfigMessageId} for scrim ${scrim.id}: ${(error as Error).message}`
        );
        message = null;
      }
    }
    if (!message) {
      logger.warn(
        `Admin config message ${scrim.adminConfigMessageId} for scrim ${scrim.id} not found, creating a new one`
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
      include: { _count: { select: { registeredTeams: true } } },
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
        `Scrim ${scrim.id} does not have auto-close registration enabled`
      );
      return false;
    }
    if (scrimWithTeamLength._count.registeredTeams >= scrim.maxTeams) {
      logger.info(
        `Scrim ${scrim.id} has reached max teams (${scrim.maxTeams})`
      );
      return true;
    }
    return false;
  }
  async unregisterTeam(team: RegisteredTeam) {
    const scrim = await prisma.scrim.findUnique({
      where: { id: team.scrimId },
    });
    if (!scrim) {
      logger.error(`Scrim with ID ${team.scrimId} not found`);
      return;
    }
    await this.removeTeamSlot(scrim, team);
    await prisma.registeredTeam.delete({
      where: { id: team.id },
    });
    try {
      if (!team.messageId) return;
      const channel = await this.client.channels.fetch(
        scrim.participantsChannelId
      );
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        logger.error(
          `Participants channel ${scrim.participantsChannelId} not found or not text-based`
        );
        return;
      }
      const message = await channel.messages.fetch(team.messageId);
      if (!message) {
        logger.error(
          `Team message with ID ${team.messageId} not found in channel ${channel.id}`
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
    team: RegisteredTeam,
    slotNumber: number = -1,
    force: boolean = false
  ) {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
      select: { userId: true },
    });
    const reservedSlot = await prisma.reservedSlot.findFirst({
      where: {
        scrimId: scrim.id,
        userId: {
          in: teamMembers.map((tm) => tm.userId),
        },
      },
      orderBy: { slotNumber: "asc" },
    });
    const performAutoSlot =
      scrim.autoSlotList || reservedSlot || slotNumber != -1 || force;
    if (!performAutoSlot) {
      logger.info(
        `Scrim ${scrim.id} is not in auto slotlist mode and team ${team.id} does not have a reserved slot`
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
      data: { scrimId: scrim.id, registeredTeamId: team.id, slotNumber },
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

  async removeTeamSlot(scrim: Scrim, team: RegisteredTeam) {
    const assigned = await prisma.assignedSlot.findFirst({
      where: { scrimId: scrim.id, registeredTeamId: team.id },
    });
    if (!assigned) {
      logger.warn(
        `Team ${team.id} does not have an assigned slot in scrim ${scrim.id}`
      );
      return;
    }
    await prisma.assignedSlot.deleteMany({
      where: { scrimId: scrim.id, registeredTeamId: team.id },
    });

    this.client.rolemanageService.removeParticipantRoleFromTeam(assigned);
    this.client.eventLogger.logEvent("slotUnassigned", {
      team,
      unassignedSlot: assigned,
      trigger: { type: "system" },
    });
    return assigned;
  }

  async fillSlotList(scrim: Scrim, type: "normal" | "random" = "normal") {
    let teams = await prisma.registeredTeam.findMany({
      where: {
        scrimId: scrim.id,
        assignedSlots: { none: {} },
      },
      orderBy: { createdAt: "asc" },
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
      editRegisteredTeamDetails(scrim, team, this.client);
    }
  }

  async registerTeam(scrim?: Scrim | null, team?: Team | null) {
    if (!team) {
      throw new BracketError(
        "Team not found or you do not have permission to register this team"
      );
    }
    if (team.banned) {
      throw new BracketError(
        `Your team is banned from participating in scrims.${
          team.banReason ? ` Reason: ${team.banReason}` : ""
        }`
      );
    }
    if (!scrim) {
      throw new BracketError(
        "This channel is not set up for team registration"
      );
    }
    if (scrim.stage != Stage.REGISTRATION) {
      throw new BracketError(
        "This scrim is not currently open for registration"
      );
    }

    const existing = await prisma.registeredTeam.findUnique({
      where: { scrimId_teamId: { scrimId: scrim.id, teamId: team.id } },
    });

    if (existing) {
      throw new BracketError("This team is already registered for the scrim");
    }
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    });
    const mainPlayers = teamMembers.filter((tm) => tm.role != "SUBSTITUTE");
    const subPlayers = teamMembers.filter((tm) => tm.role === "SUBSTITUTE");
    if (mainPlayers.length < scrim.minPlayersPerTeam) {
      throw new BracketError(
        `Your team does not have enough main players to register. Minimum required is ${scrim.minPlayersPerTeam}.`
      );
    }
    if (mainPlayers.length > scrim.maxPlayersPerTeam) {
      throw new BracketError(
        `Your team has too many main players to register. Maximum allowed is ${scrim.maxPlayersPerTeam}.`
      );
    }
    if (subPlayers.length > scrim.maxSubstitutePerTeam) {
      throw new BracketError(
        `Your team has too many substitutes to register. Maximum allowed is ${scrim.maxSubstitutePerTeam}.`
      );
    }
    const registeredTeam = await prisma.registeredTeam.create({
      data: {
        name: team.name,
        scrimId: scrim.id,
        teamId: team.id,
        registeredTeamMembers: {
          create: teamMembers.map((tm) => ({
            userId: tm.userId,
            role: tm.role,
            ingameName: tm.ingameName,
            position: tm.position,
          })),
        },
      },
    });
    const client = this.client;
    async function assignSlotThenSend(scrim: Scrim) {
      await client.scrimService.assignTeamSlot(scrim, registeredTeam);
      await editRegisteredTeamDetails(scrim, registeredTeam, client);
    }
    suppress(assignSlotThenSend(scrim));
    return registeredTeam;
  }
}
