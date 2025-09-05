import { Team } from "@prisma/client";
import { client } from "@/client";
import { prisma } from "@/lib/prisma";
import { EmbedBuilder } from "discord.js";

export async function teamDetailsEmbed(team: Team) {
  const captain = await prisma.teamMember.findFirst({
    where: { teamId: team.id, isCaptain: true },
  });
  const captainUser = captain ? await client.users.fetch(captain.userId) : null;

  const isApprove = await prisma.assignedSlot.findFirst({
    where: { teamId: team.id },
  });
  const members = await prisma.teamMember.findMany({
    where: { teamId: team.id },
  });

  const mainMembers =
    members
      .filter((m) => !m.isSubstitute)
      .map((m) => `<@${m.userId}>(${m.userId})`)
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
    .setTitle(`${isApprove ? "✅ " : ""}Team: ${team.name}`)
    .setAuthor({
      name: "Scrim Team Details",
      iconURL: "https://i.imgur.com/AfFp7pu.png",
    })
    .setThumbnail("https://i.imgur.com/AfFp7pu.png")
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
    )
    .setTimestamp(new Date(team.updatedAt))
    .setFooter({
      text: "Last updated",
      iconURL: "https://i.imgur.com/AfFp7pu.png",
    });

  return embed;
}
