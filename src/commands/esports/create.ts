import {
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  OverwriteResolvable,
  SlashCommandBuilder,
} from 'discord.js'
import { Command } from '@/base/classes/command'
import { prisma } from '@/lib/prisma'
import * as dateFns from 'date-fns'
import { scrimTemplateMap } from '@/templates/scrim'
import { checkIsGuildSetup } from '@/checks/is-guild-setup'
import { isScrimAdmin } from '@/checks/scrim-admin'
import { safeRunChecks } from '@/lib/utils'
import { CommandInfo } from '@/types/command'
import { botHasPermissions } from '@/checks/permissions'
import { ScrimSettings } from '@/types'
import { BracketError } from '@/base/classes/error'
import { filterPresets } from '@/database'
import { fromZonedTime } from 'date-fns-tz'

export default class CreateScrim extends Command {
  data = new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new scrim')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Name of the scrim')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50)
    )
    .addStringOption((option) =>
      option
        .setName('template')
        .setDescription('Template for the scrim')
        .setRequired(false)
        .addChoices(
          [...scrimTemplateMap.values()].map((template) => ({
            name: template.name,
            value: template.value,
          }))
        )
    )
    .addStringOption((option) =>
      option
        .setName('preset')
        .setDescription('Saved preset to use for the scrim')
        .setRequired(false)
        .setAutocomplete(true)
    )

  info: CommandInfo = {
    name: 'create',
    description: 'Create a new scrim.',
    longDescription:
      'Create a new scrim with a specified name and optional template. The template pre-fills settings for common scrim types.',
    usageExamples: ['/create name:My Scrim template:Pubg - Solo'],
    category: 'Esports',
    options: [
      {
        name: 'name',
        description: 'Name of the scrim',
        type: 'STRING',
        required: true,
      },
      {
        name: 'template',
        description: 'Template for the scrim',
        type: 'STRING',
        required: false,
      },
      {
        name: 'preset',
        description: 'Saved preset to use for the scrim',
        type: 'STRING',
        required: false,
      },
    ],
  }
  checks = [
    botHasPermissions(
      'ManageChannels',
      'ManageRoles',
      'SendMessages',
      'ViewChannel',
      'ReadMessageHistory'
    ),
  ]

  async loadPreset(
    guildId: string,
    presetName: string
  ): Promise<Partial<ScrimSettings>> {
    const preset = await prisma.scrimPreset.findFirst({
      where: { guildId, name: presetName },
    })
    if (!preset) {
      throw new BracketError(`Preset \`${presetName}\` not found.`)
    }
    return preset.settings as Partial<ScrimSettings>
  }

  getScrimSettings(settings: Partial<ScrimSettings>): ScrimSettings {
    return {
      maxTeams: settings.maxTeams ?? 16,
      minPlayersPerTeam: settings.minPlayersPerTeam ?? 4,
      maxPlayersPerTeam: settings.maxPlayersPerTeam ?? 4,
      maxSubstitutePerTeam: settings.maxSubstitutePerTeam ?? 0,
      autoSlotList: settings.autoSlotList ?? true,
      autoCloseRegistration: settings.autoCloseRegistration ?? true,
    }
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>) {
    await interaction.deferReply({ flags: ['Ephemeral'] })
    const adminCheckResult = await safeRunChecks(interaction, isScrimAdmin)
    if (!adminCheckResult.success) {
      await interaction.editReply({
        content: adminCheckResult.reason,
      })
      return
    }
    const guild = interaction.guild
    const result = await checkIsGuildSetup(guild)
    if (!result.valid) {
      await interaction.editReply({
        content: result.message,
      })
      return
    }
    const guildConfig = result.config
    const templateValue = interaction.options.getString('template')
    const template = templateValue
      ? scrimTemplateMap.get(templateValue as any)
      : undefined
    const presetName = interaction.options.getString('preset')
    if (presetName && template) {
      await interaction.editReply({
        content: 'You can only use either a template or a preset, not both.',
      })
      return
    }

    const name = interaction.options.getString('name', true)

    const botOverwrites: OverwriteResolvable = {
      id: this.client.user!.id,
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
    }
    const category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ['ViewChannel'],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
        botOverwrites,
      ],
    })
    const adminChannel = await category.children.create({
      name: 'admin',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ['ViewChannel'],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
        botOverwrites,
      ],
    })
    const logsChannel = await category.children.create({
      name: 'logs',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ['ViewChannel'],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
        botOverwrites,
      ],
    })
    const registrationChannel = await category.children.create({
      name: 'register',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ['ViewChannel'],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
        botOverwrites,
      ],
    })

    const participantsChannel = await category.children.create({
      name: 'participants',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: ['ViewChannel'],
        },
        {
          id: guildConfig.adminRoleId,
          allow: ['ViewChannel', 'ReadMessageHistory'],
        },
        botOverwrites,
      ],
    })

    const participantRole =
      await this.client.rolemanageService.createParticipantRole(guild)

    let scrim
    let partialSettings: Partial<ScrimSettings> = {}
    if (presetName) {
      partialSettings = await this.loadPreset(guild.id, presetName)
    } else if (template) {
      partialSettings = {
        maxTeams: template.maxTeams,
        minPlayersPerTeam: template.minPlayersPerTeam,
        maxPlayersPerTeam: template.maxPlayersPerTeam,
        maxSubstitutePerTeam: template.maxSubstitutePerTeam,
      }
    }

    const settings = this.getScrimSettings(partialSettings)
    const autocleanTime = fromZonedTime(
      dateFns.set(new Date(0), {
        hours: 4,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      }),
      guildConfig?.timezone || 'UTC'
    )

    scrim = await prisma.scrim.create({
      data: {
        name,
        guildId: guild.id,
        discordCategoryId: category.id,
        adminChannelId: adminChannel.id,
        logsChannelId: logsChannel.id,
        participantsChannelId: participantsChannel.id,
        participantRoleId: participantRole.id,
        registrationChannelId: registrationChannel.id,
        adminConfigMessageId: '',
        registrationStartTime: dateFns.addDays(new Date(), 1),
        openDays: [0, 1, 2, 3, 4, 5, 6],
        autocleanTime,
        ...settings,
      },
    })
    await this.client.scrimService.updateScrimConfigMessage(scrim)
    await this.client.scrimService.scheduleRegistrationStart(scrim)
    await this.client.scrimService.scheduleAutoCleanup(scrim)

    await interaction.editReply({
      content: `Scrim created successfully!`,
    })
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true)
    if (focusedOption.name !== 'preset') return
    const search = focusedOption.value
    const presets = await filterPresets(interaction.guildId!, search)
    await interaction.respond(
      presets.map((preset) => ({
        name: preset.name,
        value: preset.name,
      }))
    )
  }
}
