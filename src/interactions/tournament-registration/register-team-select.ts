import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { BracketError } from '@/base/classes/error'
import { prisma } from '@/lib/prisma'
import { StringSelectMenuInteraction } from 'discord.js'
import { parseIdFromString } from '@/lib/utils'

export default class RegisterTeamForTournamentSelect extends IdentityInteraction<'string_select'> {
  type = 'string_select' as const
  id = 'register_team_for_tournament'

  async execute(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply({ ephemeral: true })

    const tournamentId = parseIdFromString(interaction.customId)
    if (!tournamentId) {
      await interaction.editReply({ content: 'Invalid tournament ID.' })
      return
    }

    const teamIdStr = interaction.values[0]
    if (!teamIdStr) {
      await interaction.editReply({ content: 'No team selected.' })
      return
    }
    const teamId = parseInt(teamIdStr)

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      await interaction.editReply({
        content: 'Tournament not found.',
      })
      return
    }

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: {
          some: {
            userId: interaction.user.id,
            role: 'CAPTAIN',
          },
        },
      },
    })

    if (!team) {
      await interaction.editReply({
        content: 'Team not found or you are not the captain.',
      })
      return
    }

    try {
      const registeredTeam = await this.client.tournamentService.registerTeam(
        tournament,
        team
      )

      await interaction.editReply({
        content: `Team **${registeredTeam.name}** has been successfully registered for **${tournament.name}**!`,
      })

      // Update the original message to remove the select menu
      if (interaction.message) {
        await interaction.message.edit({
          content: `Team **${registeredTeam.name}** registered successfully!`,
          components: [],
        })
      }
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
