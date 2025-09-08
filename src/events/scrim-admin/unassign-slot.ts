import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, suppress } from "@/lib/utils";
import { editTeamDetails } from "@/ui/messages/teams";
import { Interaction, CacheType } from "discord.js";
export default class UnassignSlot extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("unassign-slot:")) return;

    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
      await interaction.reply({
        content: "Invalid team ID.",
        ephemeral: true,
      });
      return;
    }
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        AssignedSlot: {
          where: { teamId },
          include: {
            team: {
              include: {
                TeamMember: true,
              },
            },
          },
        },
      },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This command can only be used in a scrim admin channel.",
        ephemeral: true,
      });
      return;
    }
    if (scrim.AssignedSlot.length === 0) {
      await interaction.reply({
        content: "This team does not have a slot assigned.",
        ephemeral: true,
      });
      return;
    }
    const assignedSlot = scrim.AssignedSlot[0]!;
    await prisma.assignedSlot.deleteMany({
      where: {
        scrimId: scrim.id,
        teamId,
      },
    });
    await interaction.reply({
      content: `Unassigned slot for team ${assignedSlot.team.name}.`,
      flags: "Ephemeral",
    });
    await suppress(editTeamDetails(scrim, assignedSlot.team, this.client));
  }
}
