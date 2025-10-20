import { BracketClient } from '@/base/classes/client'
import { prisma } from '@/lib/prisma'
import { AssignedSlot, RegisteredTeam, Scrim, Team } from '@prisma/client'
import { EmbedBuilder, TextChannel } from 'discord.js'

type EventLoggerPayload = {
  registrationChannelOpened: {
    channelId: string
    trigger: TriggerSource
  }
  teamRegistered: {
    team: RegisteredTeam
    trigger: TriggerSource
  }
  slotAssigned: {
    team: RegisteredTeam
    assignedSlot: AssignedSlot
    trigger: TriggerSource
  }
  slotUnassigned: {
    team: RegisteredTeam
    unassignedSlot: AssignedSlot
    trigger: TriggerSource
  }
  teamKicked: {
    team: RegisteredTeam
    trigger: TriggerSource
  }
  teamBanned: {
    team: RegisteredTeam
    trigger: TriggerSource
  }
  roomDetailsPosted: {
    scrimId: number
    trigger: TriggerSource
  }
  registrationClosed: {
    scrim: Scrim
  }
  fatalError: {
    scrim: Scrim
    error: string
  }
}

type TriggerSource =
  | {
      type: 'system'
    }
  | {
      type: 'user'
      userId: string
      username: string
    }

export class EventLogger {
  constructor(private client: BracketClient) {}
  async logEvent<T extends keyof EventLoggerPayload>(
    event: T,
    payload: EventLoggerPayload[T]
  ) {
    switch (event) {
      case 'registrationChannelOpened':
        await this.logRegistrationChannelOpened(
          payload as EventLoggerPayload['registrationChannelOpened']
        )
        break
      case 'teamRegistered':
        await this.logTeamRegistration(
          payload as EventLoggerPayload['teamRegistered']
        )
        break
      case 'slotAssigned':
        await this.logSlotAssignment(
          payload as EventLoggerPayload['slotAssigned']
        )
        break
      case 'slotUnassigned':
        await this.logSlotUnassignment(
          payload as EventLoggerPayload['slotUnassigned']
        )
        break
      case 'teamKicked':
        await this.logTeamKick(payload as EventLoggerPayload['teamKicked'])
        break
      case 'teamBanned':
        await this.logTeamBan(payload as EventLoggerPayload['teamBanned'])
        break
      case 'roomDetailsPosted':
        await this.logRoomDetailsPosted(
          payload as EventLoggerPayload['roomDetailsPosted']
        )
        break
      case 'registrationClosed':
        await this.logRegistrationClosed(
          payload as EventLoggerPayload['registrationClosed']
        )
        break
      case 'fatalError':
        await this.logFatalError(payload as EventLoggerPayload['fatalError'])
        break

      default:
        throw new Error(`Unknown event type: ${event}`)
    }
  }

  private async getLogsChannel(channelId: string) {
    const channel = await this.client.channels.fetch(channelId)
    if (!channel || !channel.isTextBased() || channel.isDMBased()) return null
    return channel as TextChannel
  }

  private formatTrigger(trigger: TriggerSource) {
    if (trigger.type === 'system') return ''
    return ` by <@${trigger.userId}> (${trigger.username})`
  }

  private async logRegistrationChannelOpened(
    payload: EventLoggerPayload['registrationChannelOpened']
  ) {
    const { channelId, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: channelId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Registration opened for @everyone in <#${channelId}> **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('Aqua')
    await logChannel.send({ embeds: [embed] })
  }

  private async logTeamRegistration(
    payload: EventLoggerPayload['teamRegistered']
  ) {
    const { team, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { id: team.scrimId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Team **${team.name}** (${team.id}) has registered for the scrim **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('Green')
    // TODO: Maybe need a jump url
    await logChannel.send({ embeds: [embed] })
  }

  private async logSlotAssignment(payload: EventLoggerPayload['slotAssigned']) {
    const { team, assignedSlot, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { id: team.scrimId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Team **${team.name}** has been assigned to slot **${assignedSlot.slotNumber}** in the scrim **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('Blue')
    await logChannel.send({ embeds: [embed] })
  }

  private async logSlotUnassignment(
    payload: EventLoggerPayload['slotUnassigned']
  ) {
    const { team, unassignedSlot, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { id: team.scrimId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Team **${team.name}** has been unassigned from slot **${unassignedSlot.slotNumber}** in the scrim **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('Orange')
    await logChannel.send({ embeds: [embed] })
  }

  private async logTeamKick(payload: EventLoggerPayload['teamKicked']) {
    const { team, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { id: team.scrimId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Team **${team.name}** has been kicked from the scrim **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('Red')
    await logChannel.send({ embeds: [embed] })
  }

  private async logTeamBan(payload: EventLoggerPayload['teamBanned']) {
    const { team, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { id: team.scrimId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Team **${team.name}** has been banned from the scrim **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('DarkRed')
    await logChannel.send({ embeds: [embed] })
  }

  private async logRoomDetailsPosted(
    payload: EventLoggerPayload['roomDetailsPosted']
  ) {
    const { scrimId, trigger } = payload
    const scrim = await prisma.scrim.findFirst({
      where: { id: scrimId },
    })
    if (!scrim) return
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Room details have been posted for the scrim **(Scrim ID: ${scrim.id})**` +
          this.formatTrigger(trigger)
      )
      .setColor('Purple')
    await logChannel.send({ embeds: [embed] })
  }

  private async logRegistrationClosed(
    payload: EventLoggerPayload['registrationClosed']
  ) {
    const { scrim } = payload
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setDescription(
        `Registration has been closed for the scrim **(Scrim ID: ${scrim.id})**`
      )
      .setColor('DarkAqua')
    await logChannel.send({ embeds: [embed] })
  }

  private async logFatalError(payload: EventLoggerPayload['fatalError']) {
    const { scrim, error } = payload
    const logChannel = await this.getLogsChannel(scrim.logsChannelId)
    if (!logChannel) return
    const embed = new EmbedBuilder()
      .setTitle(`Fatal Error in Scrim ID: ${scrim.id}`)
      .setDescription(`An unexpected error occurred:\n\`\`\`${error}\`\`\``)
      .setColor('DarkRed')
    await logChannel.send({ embeds: [embed] })
  }
}
