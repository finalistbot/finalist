import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { BracketError } from '@/base/classes/error'
import { prisma } from '@/lib/prisma'
import { ButtonInteraction } from 'discord.js'
import { parseIdFromString } from '@/lib/utils'

export default class StartTournamentRegistration extends IdentityInteraction<'button'> {
  type = 'button' as const
  id = 'start_tournament_registration'

  async execute(interaction: ButtonInteraction) {
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
      await interaction.editReply({
        content: 'Tournament not found.',
      })
      return
    }

    try {
      await this.client.tournamentService.openRegistration(tournament)
      await interaction.editReply({
        content: `Tournament registration has been opened! Teams can now register in <#${tournament.registrationChannelId}>.`,
      })
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({
          content: error.message,
        })
      } else {
        throw error
      }
    }
  }
}
