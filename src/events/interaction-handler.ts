import { Interaction } from "discord.js";
import { Event } from "../base/classes/event";
import {
  IdentityInteractionRegistry,
  IdentityInteractionType,
} from "@/base/classes/identity-interaction";

export default class InteractionHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    let type: IdentityInteractionType;
    if (interaction.isModalSubmit()) type = "modal";
    else if (interaction.isButton()) type = "button";
    else if (interaction.isStringSelectMenu()) type = "string_select";
    else return;
    const customId = interaction.customId.split(":")[0];
    if (!customId) return;
    const identityInteraction = IdentityInteractionRegistry.get(type, customId);
    if (!identityInteraction) return;
    try {
      await identityInteraction.execute(interaction);
    } catch (err) {
      console.error(`Error executing identity interaction ${customId}:`, err);
    }
  }
}
