import { BracketError } from '@/base/classes/error'
import { Event } from '@/base/classes/event'
import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { BRAND_COLOR } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { parseIdFromString } from '@/lib/utils'
import teamDetailsEmbed from '@/ui/embeds/team-details'
import {
  Interaction,
  CacheType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Embed,
  EmbedBuilder,
  ButtonInteraction,
  ModalBuilder,
  LabelBuilder,
} from 'discord.js'
export default class ShowRegistrationSelectMenu extends IdentityInteraction<'button'> {
  id = 'show_registration_select_menu'
  type = 'button' as const
  async execute(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inGuild()) return

    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    })
    if (!scrim) return
    const alreadyRegistered = await prisma.registeredTeamMember.findFirst({
      where: {
        userId: interaction.user.id,
        registeredTeam: {
          scrimId: scrim.id,
        },
      },
    })
    if (alreadyRegistered) {
      await interaction.reply({
        content: 'You are already registered for this scrim.',
        flags: ['Ephemeral'],
      })
      return
    }
    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId,
        teamMembers: {
          some: { userId: interaction.user.id, role: 'CAPTAIN' },
        },
      },
      include: { teamMembers: true },
    })

    if (teams.length === 0) {
      await interaction.editReply({
        content:
          'You are not a captain of any team in this server. You must be a captain to register for a scrim.',
      })
      return
    }

    const memberRole = teams.reduce((acc, team) => {
      const member = team.teamMembers.find(
        (m) => m.userId === interaction.user.id
      )
      if (member) acc.set(team.id, member.role)

      return acc
    }, new Map<number, string>())

    const modal = new ModalBuilder()
      .setTitle('Register for Scrim')
      .setCustomId(`register_for_scrim_modal`)

      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Select Team')
          .setDescription('Select a team to register for the scrim')
          .setStringSelectMenuComponent((builder: StringSelectMenuBuilder) =>
            builder
              .setCustomId('team_selection')
              .setPlaceholder('Select a team ')
              .addOptions(
                teams.map((team) => ({
                  label: team.name,
                  description: `Role: ${memberRole.get(team.id)} | Tag: ${team.tag || 'N/A'}`,
                  value: team.id.toString(),
                }))
              )
          )
      )
    await interaction.showModal(modal)
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
    })
    await modalSubmit.deferReply({ flags: ['Ephemeral'] })
    const teamId = modalSubmit.fields.getStringSelectValues('team_selection')[0]
    if (!teamId) {
      await modalSubmit.editReply({
        content: 'No team selected.',
      })
      return
    }
    const parsed = parseInt(teamId)

    const team = await prisma.team.findUnique({
      where: { id: parsed, guildId: interaction.guildId! },
      include: { teamMembers: true },
    })
    if (!team) {
      await modalSubmit.editReply({ content: 'Team not found.' })
      return
    }

    const embed = await teamDetailsEmbed(team)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`register_team_for_registration:${team.id}`)
        .setLabel('Register Team')
        .setStyle(ButtonStyle.Success)
    )

    await modalSubmit.editReply({
      embeds: [embed],
      components: [row],
      content: 'Click below to confirm registration.',
    })
  }
}
