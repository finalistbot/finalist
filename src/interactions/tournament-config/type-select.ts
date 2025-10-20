import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { BracketError } from '@/base/classes/error'
import { prisma } from '@/lib/prisma'
import {
  ActionRowBuilder,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js'
import { parseIdFromString } from '@/lib/utils'
import { TournamentType } from '@prisma/client'

export class ShowTournamentTypeSelect extends IdentityInteraction<'button'> {
  type = 'button' as const
  id = 'show_tournament_type_select'

  async execute(interaction: ButtonInteraction) {
    const tournamentId = parseIdFromString(interaction.customId)
    if (!tournamentId) {
      await interaction.reply({
        content: 'Invalid tournament ID.',
        ephemeral: true,
      })
      return
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      await interaction.reply({
        content: 'Tournament not found.',
        ephemeral: true,
      })
      return
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`tournament_type_select:${tournamentId}`)
      .setPlaceholder('Select tournament type')
      .addOptions(
        {
          label: 'Single Elimination',
          value: 'SINGLE_ELIMINATION',
          description: 'Teams are eliminated after one loss',
          default: tournament.tournamentType === 'SINGLE_ELIMINATION',
        },
        {
          label: 'Double Elimination',
          value: 'DOUBLE_ELIMINATION',
          description: "Teams get a second chance in loser's bracket",
          default: tournament.tournamentType === 'DOUBLE_ELIMINATION',
        },
        {
          label: 'Round Robin',
          value: 'ROUND_ROBIN',
          description: 'Every team plays every other team',
          default: tournament.tournamentType === 'ROUND_ROBIN',
        },
        {
          label: 'Swiss System',
          value: 'SWISS',
          description: 'Teams paired by similar records',
          default: tournament.tournamentType === 'SWISS',
        }
      )

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    )

    await interaction.reply({
      content: 'Select the tournament type:',
      components: [row],
      ephemeral: true,
    })
  }
}

export class TournamentTypeSelectSubmit extends IdentityInteraction<'string_select'> {
  type = 'string_select' as const
  id = 'tournament_type_select'

  async execute(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply({ ephemeral: true })

    const tournamentId = parseIdFromString(interaction.customId)
    if (!tournamentId) {
      await interaction.editReply({ content: 'Invalid tournament ID.' })
      return
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      await interaction.editReply({ content: 'Tournament not found.' })
      return
    }

    if (tournament.stage !== 'SETUP') {
      await interaction.editReply({
        content:
          'Cannot change tournament type after registration has started.',
      })
      return
    }

    const typeValue = interaction.values[0]
    if (!typeValue) {
      await interaction.editReply({ content: 'No tournament type selected.' })
      return
    }

    const tournamentType = typeValue as TournamentType

    try {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { tournamentType },
      })

      await this.client.tournamentService.updateTournamentConfigMessage(
        tournament
      )

      const typeNames: Record<TournamentType, string> = {
        SINGLE_ELIMINATION: 'Single Elimination',
        DOUBLE_ELIMINATION: 'Double Elimination',
        ROUND_ROBIN: 'Round Robin',
        SWISS: 'Swiss System',
      }

      await interaction.editReply({
        content: `Tournament type changed to **${typeNames[tournamentType]}**!`,
      })

      // Update the original message to remove the select menu
      if (interaction.message) {
        await interaction.message.edit({
          content: `Tournament type: **${typeNames[tournamentType]}**`,
          components: [],
        })
      }
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({ content: error.message })
      } else {
        throw error
      }
    }
  }
}

export default ShowTournamentTypeSelect
