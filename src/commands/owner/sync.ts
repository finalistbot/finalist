import { Command } from '@/base/classes/command'
import { registerSlashCommands } from '@/services/slash-commands'
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export default class SyncSlashCommands extends Command {
  data = new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Sync slash commands')
  developerOnly: boolean = true
  async execute(interaction: ChatInputCommandInteraction) {
    if (!this.client.isOwner(interaction.user.id)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: ['Ephemeral'],
      })
    }
    await interaction.deferReply({ flags: 'Ephemeral' })
    const { globalCommands, devCommands } = await registerSlashCommands(
      this.client
    )
    await interaction.editReply({
      content: `Registered ${globalCommands.length} global commands and ${devCommands.length} developer commands.`,
    })
  }
}
