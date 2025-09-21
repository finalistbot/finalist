import { CheckFailure } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, suppress } from "@/lib/utils";
import { editTeamDetails } from "@/ui/messages/teams";
import { Interaction, CacheType } from "discord.js";
export default class UnassignSlot extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("unassign_slot:")) return;

    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
      await interaction.reply({
        content: "Invalid team ID.",
        flags: "Ephemeral",
      });
      return;
    }
    try {
      await checkIsScrimAdmin(interaction);
    } catch (e) {
      if (e instanceof CheckFailure) {
        await interaction.reply({
          content: "You do not have permission to perform this action.",
          flags: "Ephemeral",
        });
        return;
      }
    }
    const scrim = await prisma.scrim.findFirst({
      where: {
        participantsChannelId: interaction.channelId,
      },
    });
    if (!scrim) {
      await interaction.reply({
        content: "Scrim not found.",
        ephemeral: true,
      });
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) {
      await interaction.reply({
        content: "Team not found.",
        ephemeral: true,
      });
      return;
    }
    const assignedSlot = await this.client.scrimService.removeTeamSlot(
      scrim,
      team,
    );
    if (!assignedSlot) {
      await interaction.reply({
        content: `Team ${team.name} does not have an assigned slot.`,
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({
      content: `Unassigned slot for team ${team.name}.`,
      flags: "Ephemeral",
    });
    await suppress(editTeamDetails(scrim, team, this.client));
  }
}
