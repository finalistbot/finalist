import config from '@/config'
import { REST } from 'discord.js'

export const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN)
