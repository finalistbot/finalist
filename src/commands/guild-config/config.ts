import { Command } from '@/base/classes/command'
import { BracketError } from '@/base/classes/error'
import { popularTimeZones } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js'

export default class ConfigCommand extends Command {
  data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the guild settings')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('timezone')
        .setDescription('Set the timezone for the guild')
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('The timezone to set')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('teams-per-captain')
        .setDescription(
          'Number of teams each captain can create. Default is 1.'
        )
        .addIntegerOption((option) =>
          option
            .setName('number')
            .setDescription('The number of teams per captain')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand()
    switch (subcommand) {
      case 'timezone':
        await this.setTimezone(interaction)
        break
      case 'teams-per-captain':
        await this.setTeamsPerCaptain(interaction)
        break
      default:
        await interaction.reply({
          content: 'Unknown subcommand',
          ephemeral: true,
        })
        break
    }
  }
  async guildConfigMustExists(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: 'Ephemeral' })
    const guildConfig = await prisma.guildConfig.findFirst({
      where: { id: interaction.guildId! },
    })
    if (!guildConfig) {
      throw new BracketError('Guild is not configured, run /setup first')
    }
    return guildConfig
  }
  async setTimezone(interaction: ChatInputCommandInteraction) {
    await this.guildConfigMustExists(interaction)
    const timezone = interaction.options.getString('timezone', true)
    if (!popularTimeZones.find((tz) => tz.value === timezone)) {
      throw new BracketError('Invalid timezone')
    }
    await prisma.guildConfig.update({
      where: { id: interaction.guildId! },
      data: { timezone },
    })
    await interaction.editReply({
      content: `Timezone set to **${timezone}**`,
    })
  }
  async setTeamsPerCaptain(interaction: ChatInputCommandInteraction) {
    await this.guildConfigMustExists(interaction)
    const number = interaction.options.getInteger('number', true)
    await prisma.guildConfig.update({
      where: { id: interaction.guildId! },
      data: { teamsPerCaptain: number },
    })
    await interaction.editReply({
      content: `Teams per captain set to **${number}**`,
    })
  }
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused()
    if (interaction.options.getSubcommand() === 'timezone') {
      const filtered = popularTimeZones.filter(
        (tz) =>
          tz.label.toLowerCase().includes(focusedValue.toLowerCase()) ||
          tz.value.toLowerCase().includes(focusedValue.toLowerCase())
      )
      await interaction.respond(
        filtered.slice(0, 25).map((tz) => ({ name: tz.label, value: tz.value }))
      )
    }
  }
}
