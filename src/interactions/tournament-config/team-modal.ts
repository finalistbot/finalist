import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { BracketError } from '@/base/classes/error'
import { prisma } from '@/lib/prisma'
import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { parseIdFromString } from '@/lib/utils'

export class ShowTournamentTeamConfigModal extends IdentityInteraction<'button'> {
  type = 'button' as const
  id = 'show_tournament_team_config_modal'

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

    const modal = new ModalBuilder()
      .setCustomId(`tournament_team_config_modal:${tournamentId}`)
      .setTitle('Configure Teams')

    const maxTeamsInput = new TextInputBuilder()
      .setCustomId('max_teams')
      .setLabel('Maximum Teams')
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.maxTeams.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3)

    const minPlayersInput = new TextInputBuilder()
      .setCustomId('min_players')
      .setLabel('Minimum Players Per Team')
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.minPlayersPerTeam.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2)

    const maxPlayersInput = new TextInputBuilder()
      .setCustomId('max_players')
      .setLabel('Maximum Players Per Team')
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.maxPlayersPerTeam.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2)

    const maxSubsInput = new TextInputBuilder()
      .setCustomId('max_subs')
      .setLabel('Maximum Substitutes Per Team')
      .setStyle(TextInputStyle.Short)
      .setValue(tournament.maxSubstitutePerTeam.toString())
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2)

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(maxTeamsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(minPlayersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(maxPlayersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(maxSubsInput)
    )

    await interaction.showModal(modal)
  }
}

export class TournamentTeamConfigModalSubmit extends IdentityInteraction<'modal'> {
  type = 'modal' as const
  id = 'tournament_team_config_modal'

  async execute(interaction: ModalSubmitInteraction) {
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
        content: 'Cannot modify team settings after registration has started.',
      })
      return
    }

    const maxTeams = parseInt(interaction.fields.getTextInputValue('max_teams'))
    const minPlayers = parseInt(
      interaction.fields.getTextInputValue('min_players')
    )
    const maxPlayers = parseInt(
      interaction.fields.getTextInputValue('max_players')
    )
    const maxSubs = parseInt(interaction.fields.getTextInputValue('max_subs'))

    if (
      isNaN(maxTeams) ||
      isNaN(minPlayers) ||
      isNaN(maxPlayers) ||
      isNaN(maxSubs)
    ) {
      await interaction.editReply({
        content: 'All fields must be valid numbers.',
      })
      return
    }

    if (minPlayers > maxPlayers) {
      await interaction.editReply({
        content: 'Minimum players cannot be greater than maximum players.',
      })
      return
    }

    if (maxTeams < 2) {
      await interaction.editReply({
        content: 'Tournament must have at least 2 teams.',
      })
      return
    }

    try {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          maxTeams,
          minPlayersPerTeam: minPlayers,
          maxPlayersPerTeam: maxPlayers,
          maxSubstitutePerTeam: maxSubs,
        },
      })

      await this.client.tournamentService.updateTournamentConfigMessage(
        tournament
      )

      await interaction.editReply({
        content: 'Team settings updated successfully!',
      })
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({ content: error.message })
      } else {
        throw error
      }
    }
  }
}

export default ShowTournamentTeamConfigModal
