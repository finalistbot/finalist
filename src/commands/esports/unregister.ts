import { Command } from "@/base/classes/command";
import { checkIsNotBanned } from "@/checks/banned";
import { prisma } from "@/lib/prisma";
import { CommandInfo } from "@/types/command";
import { Stage } from "@prisma/client";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class UnregisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Unregister from the scrim");
  info: CommandInfo = {
    name: "unregister",
    description: "Unregister your team from the scrim in this channel.",
    category: "Esports",
    longDescription:
      "Unregister your team from the scrim in this channel. You must be a team captain to use this command. Once unregistered, you can register again if the registration is still open.",
    usageExamples: ["/unregister"],
  };
  checks = [checkIsNotBanned];
  load = false;
  async execute(interaction: ChatInputCommandInteraction) {
    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This channel is not set up for team registration.",
        flags: ["Ephemeral"],
      });
      return;
    }
    if (scrim.stage !== Stage.REGISTRATION) {
      await interaction.reply({
        content: "Team registration is not open.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const team = await prisma.team.findFirst({
      where: {
        scrimId: scrim.id,
        TeamMember: { some: { userId: interaction.user.id, isCaptain: true } },
      },
      include: { TeamMember: true },
    });
    if (!team) {
      await interaction.reply({
        content: "You are not a team captain in this scrim.",
        flags: ["Ephemeral"],
      });
      return;
    }

    await this.client.scrimService.unregisterTeam(team);

    await interaction.reply({
      content: "You have been unregistered from the scrim.",
      flags: ["Ephemeral"],
    });
  }
}
