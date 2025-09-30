import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { BracketError } from "@/base/classes/error";

export default class RegisterWithTeamSelect extends Event<"interactionCreate"> {
  event = "interactionCreate" as const;
  async execute(interaction: Interaction<"cached">): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "register_with_team") return;
    if (!interaction.inGuild()) return;
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    });
    if (!scrim) return;
    const alreadyRegistered = await prisma.registeredTeamMember.findFirst({
      where: {
        userId: interaction.user.id,
        registeredTeam: {
          scrimId: scrim.id,
        },
      },
    });
    if (alreadyRegistered) {
      await interaction.editReply({
        content: "You are already registered for this scrim.",
      });
      return;
    }
    const teamId = parseInt(interaction.values[0]!);
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: {
          some: {
            role: "CAPTAIN",
            userId: interaction.user.id,
          },
        },
      },
      include: { teamMembers: true },
    });
    let registeredTeam;
    try {
      registeredTeam = await this.client.scrimService.registerTeam(scrim, team);
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({ content: error.message });
      }
      throw error;
    }

    await interaction.editReply({
      content: `Team **${registeredTeam.name}** has been successfully registered for the scrim! If you need to make any changes, please contact a staff member.`,
    });
  }
}
