import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { editTeamDetails } from "@/ui/messages/teams";
import { Interaction } from "discord.js";
export default class AssignSlotSubmitEvent extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("assign_slot_submit:")) return;
    const teamId = parseIdFromString(interaction.customId);
    if (!teamId) {
      return;
    }
    const slotNumber = interaction.fields.getTextInputValue("slot_number");
    const slot = parseInt(slotNumber, 10);
    if (isNaN(slot) || slot <= 0) {
      await interaction.reply({
        content: "Please enter a valid positive integer for slot number.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { scrim: true },
    });
    if (!team) {
      await interaction.reply({
        content: "Team not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const scrimId = team.scrimId;
    const alreadyAssigned = await prisma.assignedSlot.findFirst({
      where: { scrimId, slotNumber: slot },
      include: { team: true },
    });
    if (alreadyAssigned && alreadyAssigned.teamId === teamId) {
      await interaction.reply({
        content: `Slot ${slot} is already assigned to this team.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    if (alreadyAssigned) {
      await interaction.reply({
        content: `Slot ${slot} is already assigned to team "${alreadyAssigned.team.name}". Please choose a different slot. Or use the unassign option first.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    await prisma.assignedSlot.upsert({
      where: { scrimId_teamId: { scrimId, teamId } },
      update: { slotNumber: slot },
      create: { teamId, scrimId, slotNumber: slot },
    });

    const participantRoleId = team.scrim.participantsRoleId;
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "Guild not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const participantRole = guild.roles.cache.get(participantRoleId);
    if (!participantRole) {
      await interaction.reply({
        content: "Participant role not found.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    });
    for (const member of teamMembers) {
      const guildMember = await guild.members.fetch(member.userId);
      if (!guildMember) continue;
      if (guildMember && !guildMember.roles.cache.has(participantRoleId)) {
        await guildMember.roles.add(participantRole);
      }
    }

    await interaction.reply({
      content: `Slot ${slot} assigned to team ID ${teamId}.`,
      flags: ["Ephemeral"],
    });
    await editTeamDetails(team.scrim, team, this.client);
  }
}
