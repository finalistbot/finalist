import { EmbedBuilder } from "discord.js";

import { AssignedSlot, RegisteredTeam } from "@prisma/client";

import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function registeredTeamDetailsEmbed(
  team: RegisteredTeam,
  assignedSlot: AssignedSlot | null = null
) {
  const members = await prisma.registeredTeamMember.findMany({
    where: { registeredTeamId: team.id },
  });
  members.sort((a, b) => a.position - b.position);

  const captain = members.find((m) => m.role === "CAPTAIN")!;

  // format helpers
  const formatMember = (m: (typeof members)[number]) =>
    `<@${m.userId}>${m.ingameName ? ` - ${m.ingameName}` : ""}`;

  const mainMembers =
    members
      .filter((m) => m.role !== "SUBSTITUTE" && m.role !== "CAPTAIN")
      .map((m, i) => `${i + 1}. ${formatMember(m)}`)
      .join("\n") || "None";

  const substitutes =
    members
      .filter((m) => m.role === "SUBSTITUTE")
      .map((m, i) => `${i + 1}. ${formatMember(m)}`)
      .join("\n") || "None";

  const registeredAt = team.createdAt
    ? `<t:${Math.floor(new Date(team.createdAt).getTime() / 1000)}:F>`
    : "Not registered";

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🛡️ Team: ${team.name} (ID: ${team.id})`)
    .setAuthor({
      name: "Scrim Team Details",
      iconURL: "https://i.postimg.cc/dVJBqmqv/Finalist.png",
    })
    .setThumbnail("https://i.postimg.cc/dVJBqmqv/Finalist.png")
    .setDescription(
      `**Scrim:** ${
        team.scrimId || "Not assigned"
      }\n**Registered:** ${registeredAt}`
    )
    .addFields(
      {
        name: "👑 Captain",
        value: formatMember(captain),
        inline: false,
      },
      { name: "👤 Members", value: mainMembers, inline: false },
      { name: "🟡 Substitutes", value: substitutes, inline: false },
      {
        name: "🎟️ Assigned Slot",
        value: assignedSlot
          ? `Slot Number: ${assignedSlot.slotNumber}`
          : "No slot assigned",
        inline: false,
      }
    )
    .setTimestamp(new Date(team.createdAt))
    .setFooter({
      text: "Last updated",
      iconURL: "https://i.postimg.cc/dVJBqmqv/Finalist.png",
    });

  return embed;
}
