import { ButtonInteraction, CacheType, Interaction } from 'discord.js'
import { Event } from '@/base/classes/event'
import { prisma } from '@/lib/prisma'
import { parseIdFromString, safeRunChecks } from '@/lib/utils'
import { Stage } from '@prisma/client'
import { isScrimAdmin } from '@/checks/scrim-admin'
import { BracketError } from '@/base/classes/error'
import { IdentityInteraction } from '@/base/classes/identity-interaction'

export default class CloseRegistrationButtonHandler extends IdentityInteraction<'button'> {
  id = 'close_registration'
  type = 'button' as const

  async execute(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.isButton()) return
    if (!interaction.customId.startsWith('close_registration:')) return
    await interaction.deferReply({ flags: 'Ephemeral' })
    const scrimId = parseIdFromString(interaction.customId)
    if (!scrimId) {
      await interaction.editReply({
        content: 'Invalid scrim ID.',
      })
      return
    }
    const checkResult = await safeRunChecks(interaction, isScrimAdmin)
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      })
      return
    }

    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    })
    if (!scrim) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} does not exist.`,
      })
      return
    }

    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} is not in the registration stage.`,
      })
      return
    }

    try {
      await this.client.scrimService.closeRegistration(scrim)
    } catch (e) {
      if (e instanceof BracketError) {
        await interaction.editReply({
          content: e.message,
        })
        return
      }
    }
    await interaction.editReply({
      content: `Registration for scrim with ID ${scrimId} has been closed.`,
    })
  }
}
