import { GatewayIntentBits } from 'discord.js'
import { BracketClient } from './base/classes/client'

export const client = new BracketClient(
  {
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  },
  { ownerIds: ['347724952100667394', '490780810216079361'] }
)

client.setMaxListeners(20)
