import { AssignedSlot, Team } from "@prisma/client";
import { client } from "@/client";
import { prisma } from "@/lib/prisma";
import { EmbedBuilder } from "discord.js";

export async function teamDetailsEmbed(
  team: Team,
  assignedSlot: AssignedSlot | null = null,
) {
  const captain = await prisma.teamMember.findFirst({
    where: { teamId: team.id, isCaptain: true },
  });
  const captainUser = captain ? await client.users.fetch(captain.userId) : null;

  const members = await prisma.teamMember.findMany({
    where: { teamId: team.id },
  });

  const mainMembers =
    members
      .filter((m) => !m.isSubstitute)
      .map((m) => `<@${m.userId}>`)
      .join("\n") || "None";

  const substitutes =
    members
      .filter((m) => m.isSubstitute)
      .map((m) => `<@${m.userId}>`)
      .join("\n") || "None";

  const registeredAt = team.registeredAt
    ? `<t:${Math.floor(new Date(team.registeredAt).getTime() / 1000)}:F>`
    : "Not registered";

  const embed = new EmbedBuilder()
    .setColor("#0052cc")
    .setTitle(`🛡️ Team: ${team.name} (ID: ${team.id})`)
    .setAuthor({
      name: "Scrim Team Details",
      iconURL: "https://i.postimg.cc/dVJBqmqv/Finalist.png",
    })
    .setThumbnail("https://i.postimg.cc/dVJBqmqv/Finalist.png")
    .setDescription(
      `**Scrim:** ${
        team.scrimId || "Not assigned"
      }\n**Registered:** ${registeredAt}`,
    )
    .addFields(
      {
        name: "👑 Captain",
        value: captainUser ? captainUser.tag : "No captain assigned",
        inline: true,
      },
      { name: "👤 Members", value: mainMembers, inline: true },
      { name: "🟡 Substitutes", value: substitutes, inline: true },
      {
        name: "🎟️ Assigned Slot",
        value: assignedSlot
          ? `Slot Number: ${assignedSlot.slotNumber}`
          : "No slot assigned",
        inline: false,
      },
    )
    .setTimestamp(new Date(team.updatedAt))
    .setFooter({
      text: "Last updated",
      iconURL: "https://i.postimg.cc/dVJBqmqv/Finalist.png",
    });

  return embed;
}
