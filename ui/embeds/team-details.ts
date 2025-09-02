import { Team } from "@prisma/client";
import { client } from "@/client";
import { prisma } from "@/lib/prisma";
import { EmbedBuilder } from "discord.js";

export async function teamDetailsEmbed(team: Team) {
  const captain = await prisma.teamMember.findFirst({
    where: { teamId: team.id, isCaptain: true },
  });
  const captainUser = captain ? await client.users.fetch(captain.userId) : null;

  const members = await prisma.teamMember.findMany({
    where: { teamId: team.id },
  });

  const memberList =
    members.length > 0
      ? members.map((member) => `<@${member.userId}>`).join("\n")
      : "No members";

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Team: ${team.name}`)
    .setColor("Blue")
    .addFields(
      {
        name: "👑 Captain",
        value: captainUser ? captainUser.username : "No captain assigned",
        inline: false,
      },
      {
        name: "👥 Members",
        value: memberList,
        inline: false,
      },
    )
    .setTimestamp();

  return embed;
}
