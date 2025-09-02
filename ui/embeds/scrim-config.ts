import { BracketClient } from "@/base/classes/client";
import { discordTimestamp } from "@/lib/utils";
import { Scrim } from "@prisma/client";
import { EmbedBuilder } from "discord.js";

export function scrimConfigEmbed(scrim: Scrim, client: BracketClient) {
  return new EmbedBuilder()
    .setTitle("Scrim Configuration")
    .setColor("Green")
    .addFields(
      { name: "Scrim Name", value: scrim.name, inline: false },
      { name: "Max Teams", value: scrim.maxTeams.toString(), inline: false },
      {
        name: "Players per Team",
        value:
          scrim.minPlayersPerTeam && scrim.maxPlayersPerTeam
            ? scrim.minPlayersPerTeam === scrim.maxPlayersPerTeam
              ? `${scrim.minPlayersPerTeam} players`
              : `${scrim.minPlayersPerTeam}–${scrim.maxPlayersPerTeam} players`
            : "Not set",
        inline: false,
      },
      {
        name: "Substitutes per Team",
        value: scrim.maxSubstitutePerTeam.toString(),
        inline: false,
      },
      {
        name: "Registration Start Time",
        value: discordTimestamp(scrim.registrationStartTime),
        inline: false,
      },
    )
    .setFooter({
      text: `Scrim ID: ${scrim.id}\nYou can't edit after atleast one team has registered.`,
    })
    .setThumbnail("https://i.ibb.co/G4v0D8Zj/image.png")
    .setAuthor({
      name: client.user?.username || "Scrim Bot",
    })
    .setImage("https://i.ibb.co/XxXCWznH/image.png");
}
