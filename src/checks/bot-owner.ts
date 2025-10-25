import { Interaction } from "discord.js";

import { InteractionCheck } from "@/base/classes/check";
import { BracketClient } from "@/base/classes/client";
import { CheckFailure } from "@/base/classes/error";

export const checkIsBotOwner: InteractionCheck = async (
  interaction: Interaction
) => {
  const client = interaction.client as BracketClient;
  const owners = client.ownerIds;
  if (interaction.user.id === client.application?.owner?.id) return true;
  if (owners.has(interaction.user.id)) return true;
  throw new CheckFailure("You must be the bot owner to use this command.");
};
