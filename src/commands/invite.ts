import { Command } from "@/base/classes/command";
import { sendBotInviteEmbed } from "@/ui/embeds/bot-invite";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

export default class InviteCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the bot invite link.");

  async execute(interaction: ChatInputCommandInteraction) {
    await sendBotInviteEmbed(
      interaction.channel as TextChannel,
      this.client.user!.id
    );
  }
}
