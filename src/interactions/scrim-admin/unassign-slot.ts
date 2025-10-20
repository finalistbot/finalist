import { Event } from '@/base/classes/event'
import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { isScrimAdmin } from '@/checks/scrim-admin'
import { prisma } from '@/lib/prisma'
import { parseIdFromString, safeRunChecks, suppress } from '@/lib/utils'
import { editRegisteredTeamDetails } from '@/ui/messages/teams'
import { Interaction, CacheType, ButtonInteraction } from 'discord.js'
export default class UnassignSlot extends IdentityInteraction<'button'> {
  id = 'unassign_slot'
  type = 'button' as const
  async execute(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.isButton()) return
    if (!interaction.customId.startsWith('unassign_slot:')) return

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
    const scrim = await prisma.scrim.findFirst({
      where: {
        participantsChannelId: interaction.channelId,
      },
    })
    if (!scrim) {
      await interaction.editReply({
        content: 'Scrim not found.',
      })
      return
    }
    const team = await prisma.registeredTeam.findUnique({
      where: { id: teamId },
    })
    if (!team) {
      await interaction.editReply({
        content: 'Team not found.',
      })
      return
    }
    const assignedSlot = await this.client.scrimService.removeTeamSlot(
      scrim,
      team
    )
    if (!assignedSlot) {
      await interaction.editReply({
        content: `Team ${team.name} does not have an assigned slot.`,
      })
      return
    }
    await interaction.editReply({
      content: `Unassigned slot for team ${team.name}.`,
    })
    await suppress(editRegisteredTeamDetails(scrim, team, this.client))
  }
}
