import { Interaction } from 'discord.js'

export type InteractionCheck = (
  interaction: Interaction
) => Promise<boolean> | boolean
