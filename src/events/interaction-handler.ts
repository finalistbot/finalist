import { Interaction } from "discord.js";
import { Event } from "../base/classes/event";

type InteractionHandlerFn = (
  interaction: Interaction<"cached">
) => Promise<void> | void;

interface HandlerRegistry {
  [type: string]: {
    [customId: string]: InteractionHandlerFn;
  };
}

const registry: HandlerRegistry = {};

export function registerInteractionHandler(
  type: string,
  customId: string,
  handler: InteractionHandlerFn
) {
  if (!registry[type]) registry[type] = {};
  registry[type][customId] = handler;
}

export default class InteractionHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">) {
    let type: string;
    let customId: string;

    switch (true) {
      case interaction.isButton():
        type = "button";
        customId = interaction.customId;
        break;
      case interaction.isStringSelectMenu():
        type = "select";
        customId = interaction.customId;
        break;
      case interaction.isModalSubmit():
        type = "modal";
        customId = interaction.customId;
        break;
      case interaction.isChatInputCommand():
        type = "command";
        customId = interaction.commandName;
        break;
      default:
        type = "";
        customId = "";
    }

    if (type && customId && registry[type]?.[customId]) {
      await registry[type]![customId]!(interaction);
    }
  }
}
