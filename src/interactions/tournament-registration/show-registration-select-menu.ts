import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { prisma } from '@/lib/prisma'
import {
  ActionRowBuilder,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js'

export default class ShowTournamentRegistrationSelectMenu extends IdentityInteraction<'button'> {
  type = 'button' as const
  id = 'show_tournament_registration_select_menu'

  async execute(interaction: ButtonInteraction | StringSelectMenuInteraction) {
    await interaction.deferReply({ ephemeral: true })

    const tournament = await prisma.tournament.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
        guildId: interaction.guildId!,
      },
    })

    if (!tournament) {
      await interaction.editReply({
        content: 'This channel is not set up for tournament registration.',
      })
      return
    }

    // Get user's teams where they are captain
    const userTeams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId!,
        teamMembers: {
          some: {
            userId: interaction.user.id,
            role: 'CAPTAIN',
          },
        },
      },
      include: {
        tournamentTeams: {
          where: {
            tournamentId: tournament.id,
          },
        },
      },
    })

    if (userTeams.length === 0) {
      await interaction.editReply({
        content:
          "You don't have any teams where you are the captain. Create a team first using `/team create`.",
      })
      return
    }

    // Filter out teams already registered
    const availableTeams = userTeams.filter(
      (team) => team.tournamentTeams.length === 0
    )

    if (availableTeams.length === 0) {
      await interaction.editReply({
        content: 'All your teams are already registered for this tournament.',
      })
      return
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`register_team_for_tournament:${tournament.id}`)
      .setPlaceholder('Select a team to register')
      .addOptions(
        availableTeams.map((team) => ({
          label: team.name,
          value: team.id.toString(),
          description: `Team ID: ${team.id}`,
        }))
      )

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    )

    await interaction.editReply({
      content: 'Select a team to register for the tournament:',
      components: [row],
    })
  }
}
