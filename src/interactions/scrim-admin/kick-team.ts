import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { isScrimAdmin } from '@/checks/scrim-admin'
import { prisma } from '@/lib/prisma'
import { parseIdFromString, safeRunChecks } from '@/lib/utils'
import { ButtonInteraction } from 'discord.js'

export default class KickTeam extends IdentityInteraction<'button'> {
  id = 'kick_team'
  type = 'button' as const
  async execute(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.isButton()) return
    if (!interaction.customId.startsWith('kick_team:')) return

    const teamId = parseIdFromString(interaction.customId)
    if (!teamId) {
      await interaction.reply({
        content: 'Invalid team ID.',
        flags: 'Ephemeral',
      })
      return
    }
    await interaction.deferReply({ flags: 'Ephemeral' })
    const checkResult = await safeRunChecks(interaction, isScrimAdmin)
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      })
      return
    }

    const team = await prisma.registeredTeam.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      await interaction.editReply({
        content: `Team with ID ${teamId} does not exist.`,
      })
      return
    }

    await this.client.eventLogger.logEvent('teamKicked', {
      team,
      trigger: {
        userId: interaction.user.id,
        username: interaction.user.username,
        type: 'user',
      },
    })
    await this.client.scrimService.unregisterTeam(team)

    await interaction.editReply({
      content: `Team with ID ${teamId} has been kicked.`,
    })
  }
}
