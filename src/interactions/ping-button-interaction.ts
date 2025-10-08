import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { ButtonInteraction } from "discord.js";

export default class PingButtonInteraction extends IdentityInteraction<"button"> {
  id = "ping_button";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    await interaction.reply({ content: "Pong!", ephemeral: true });
  }
}
