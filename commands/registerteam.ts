import { BracketClient } from "@/base/classes/client";
import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { randomString } from "@/lib/utils";
import { EmbedBuilder } from "discord.js";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Scrim, Team } from "@prisma/client";

export async function createTeamEmbed(
  team: Team,
  client: BracketClient,
  secret: boolean = true
) {
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
      }
    )
    .setTimestamp();
  if (!secret) {
    embed.setDescription(
      `Your team code is \`${team.code}\`. Share this code with your teammates so they can join your team by using the \`/jointeam\` command.`
    );
  }

  return embed;
}

export async function createSlotListEmbed(scrim: Scrim) {
  const teams = await prisma.team.findMany({ where: { scrimId: scrim.id } });
  const teamList = teams.length
    ? teams.map((t, i) => `${i + 1}. ${t.name} `).join("\n")
    : `No teams registered yet.`;

  return new EmbedBuilder()
    .setTitle("Team Slot List")
    .setColor("Purple")
    .setDescription(`\`\`\`${teamList}\`\`\``)
    .setFooter({ text: `Total teams: ${teams.length} | Scrim ID: ${scrim.id}` })
    .setTimestamp();
}

export default class RegisterTeam extends Command {
  data = new SlashCommandBuilder()
    .setName("registerteam")
    .setDescription("Register a new team")
    .addStringOption((option) =>
      option
        .setName("teamname")
        .setDescription("The name of the team to register")
        .setRequired(true)
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const teamName = interaction.options.getString("teamname", true);
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

    if (
      !scrim.registrationStartTime ||
      scrim.registrationStartTime > new Date()
    ) {
      await interaction.reply({
        content: "Team registration has not started yet.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const team = await prisma.$transaction(async (tx) => {
      const exists = (code: string) =>
        tx.team.findUnique({
          where: { code },
        });
      let code = randomString(6).toLowerCase();

      while (await exists(code)) {
        code = randomString(6).toLowerCase();
      }

      const team = await tx.team.create({
        data: {
          name: teamName,
          code,
          scrimId: scrim.id,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: interaction.user.id,
          isCaptain: true,
          scrimId: scrim.id,
        },
      });

      return team;
    });

    await interaction.reply({
      content: `Team **${team.name}** registered successfully!\n
      Use the code \`${team.code}\` to invite your teammates to join your team using the \`/jointeam\` command.`,
      flags: ["Ephemeral"],
    });

    const teamChannel = await interaction.guild?.channels.cache.get(
      scrim.teamChannelId
    );
    if (teamChannel?.isTextBased()) {
      const message = await teamChannel?.send({
        content: `New team registered: **${team.name}**`,
        embeds: [
          await createTeamEmbed(team, interaction.client as BracketClient),
        ],
      });
      await prisma.team.update({
        where: { id: team.id },
        data: { teamDetailsMessageId: message?.id },
      });
    }

    if (scrim.slotListMessageId) {
      try {
        const channel = interaction.channel;
        if (channel) {
          const slotListMessage = await channel.messages.fetch(
            scrim.slotListMessageId
          );
          const slotListEmbed = await createSlotListEmbed(scrim);
          await slotListMessage.edit({ embeds: [slotListEmbed] });
        } else {
          console.warn("Channel is null, cannot update slot list embed.");
        }
      } catch (err) {
        console.error("Failed to update slot list embed:", err);
      }
    }
  }
}
