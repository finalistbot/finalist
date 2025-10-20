import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import { BracketClient } from './client'

export type IdentityInteractionType = 'modal' | 'button' | 'string_select'

type InteractionTypes = {
  modal: ModalSubmitInteraction
  button: ButtonInteraction
  string_select: StringSelectMenuInteraction
}

export abstract class IdentityInteraction<T extends IdentityInteractionType> {
  abstract type: T
  abstract id: string
  abstract execute(interaction: InteractionTypes[T]): Promise<unknown>
  constructor(protected client: BracketClient) {}
}

export class IdentityInteractionRegistry {
  private static interactions = new Map<
    IdentityInteractionType,
    Map<string, IdentityInteraction<any>>
  >()

  static register<T extends IdentityInteractionType>(
    interaction: IdentityInteraction<T>
  ) {
    if (!this.interactions.has(interaction.type)) {
      this.interactions.set(interaction.type, new Map())
    }
    this.interactions.get(interaction.type)!.set(interaction.id, interaction)
  }

  static get<T extends IdentityInteractionType>(
    type: T,
    id: string
  ): IdentityInteraction<T> | undefined {
    return this.interactions.get(type)?.get(id) as
      | IdentityInteraction<T>
      | undefined
  }

  static getAllOfType<T extends IdentityInteractionType>(
    type: T
  ): IdentityInteraction<T>[] {
    return Array.from(
      (this.interactions.get(type)?.values() as Iterable<
        IdentityInteraction<T>
      >) || []
    )
  }
}
