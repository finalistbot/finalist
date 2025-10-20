import { prisma } from '@/lib/prisma'
import { parseIdFromString, safeRunChecks } from '@/lib/utils'
import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'

import { RegisteredTeam } from '@prisma/client'
import { getFirstAvailableSlot } from '@/database'
import { isScrimAdmin } from '@/checks/scrim-admin'
import { IdentityInteraction } from '@/base/classes/identity-interaction'
import { editRegisteredTeamDetails } from '@/ui/messages/teams'

function createAssignSlotModal(team: RegisteredTeam, defaultSlot: number) {
  const modal = new ModalBuilder()
    .setTitle(`Assign Slot for ${team.name}`)
    .setCustomId(`assign_slot_submit:${team.id}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Slot Number')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('slot_number')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setPlaceholder('Enter the slot number to assign')
            .setRequired(true)
            .setValue(defaultSlot.toString())
        )
    )

  return modal
}

export default class AssignSlotModal extends IdentityInteraction<'button'> {
  id = 'assign_slot_modal'
  type = 'button' as const

  async execute(interaction: ButtonInteraction) {
    const teamId = parseIdFromString(interaction.customId)
    if (!teamId) {
      return
    }
    const checkResult = await safeRunChecks(interaction, isScrimAdmin)
    if (!checkResult.success) {
      await interaction.reply({
        content: checkResult.reason,
        flags: ['Ephemeral'],
      })
      return
    }
    const team = await prisma.registeredTeam.findUnique({
      where: { id: teamId },
    })
    if (!team) {
      return
    }
    const scrim = await prisma.scrim.findFirst({
      where: { participantsChannelId: interaction.channelId! },
    })
    if (!scrim) {
      await interaction.reply({
        content: 'Scrim not found.',
        flags: ['Ephemeral'],
      })
      return
    }
    const availableSlot = await getFirstAvailableSlot(team.scrimId)
    if (availableSlot === -1) {
      await interaction.reply({
        content:
          'All slots are already assigned. Kindly use /assign-slot command.',
        flags: ['Ephemeral'],
      })
      return
    }
    const modal = createAssignSlotModal(team, availableSlot)
    await interaction.showModal(modal)
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
    })
    await modalSubmit.deferReply({ flags: ['Ephemeral'] })

    const slotNumber = modalSubmit.fields.getTextInputValue('slot_number')
    const slot = parseInt(slotNumber, 10)
    if (isNaN(slot) || slot <= 0) {
      await modalSubmit.editReply({
        content: 'Please enter a valid positive integer for slot number.',
      })
      return
    }

    const scrimId = team.scrimId
    const alreadyAssigned = await prisma.assignedSlot.findFirst({
      where: { scrimId, slotNumber: slot },
      include: { registeredTeam: true },
    })
    if (alreadyAssigned && alreadyAssigned.registeredTeamId === teamId) {
      await modalSubmit.editReply({
        content: `Slot ${slot} is already assigned to this team.`,
      })
      return
    }
    if (alreadyAssigned) {
      await modalSubmit.editReply({
        content: `Slot ${slot} is already assigned to team "${alreadyAssigned.registeredTeam.name}". Please choose a different slot. Or use the unassign option first.`,
      })
      return
    }
    await prisma.assignedSlot.deleteMany({
      where: { scrimId, registeredTeamId: teamId },
    })
    await this.client.scrimService.assignTeamSlot(scrim, team, slot)

    await modalSubmit.editReply({
      content: `Slot ${slot} assigned to team ID ${teamId}.`,
    })
    await editRegisteredTeamDetails(scrim, team, this.client)
  }
}
