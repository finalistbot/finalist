import { Command } from "@/base/classes/command";
import { prisma } from "@/lib/prisma";
import { randomString } from "@/lib/utils";
import { teamDetailsEmbed } from "@/ui/embeds/team-details";
import { Stage } from "@prisma/client";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export default class TeamCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("team")
    .setDescription("Manage your team")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new team")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the team")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("disband").setDescription("Disband your team"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("kick")
        .setDescription("Kick a member from your team")
        .addStringOption((option) =>
          option
            .setName("memberid")
            .setDescription("The ID of the member to kick")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("join")
        .setDescription("Join a team using a team code")
        .addStringOption((option) =>
          option
            .setName("teamcode")
            .setDescription("The code of the team to join")
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("substitute")
            .setDescription("Join as a substitute")
            .setRequired(false),
        ),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "create":
        await this.createTeam(interaction);
        break;
      case "disband":
        await this.disbandTeam(interaction);
        break;
      case "kick":
        await this.kickMember(interaction);
        break;
      case "join":
        await this.joinTeam(interaction);
        break;
      default:
        await interaction.reply({
          content: "Unknown subcommand.",
          flags: "Ephemeral",
        });
        return;
    }
  }

  async createTeam(interaction: ChatInputCommandInteraction) {
    const teamName = interaction.options.getString("name", true);
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This channel is not associated with any scrim.",
        flags: "Ephemeral",
      });
      return;
    }
    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.reply({
        content: "Teams can only be created during the registration stage.",
        flags: "Ephemeral",
      });
      return;
    }

    const existingTeam = await prisma.team.findFirst({
      where: { name: teamName, scrimId: scrim.id },
    });

    if (existingTeam) {
      await interaction.reply({
        content: `A team with the name "${teamName}" already exists in this scrim. Please choose a different name.`,
        flags: "Ephemeral",
      });
      return;
    }

    const teamCode = randomString(8);
    const newTeam = await prisma.team.create({
      data: {
        name: teamName,
        scrim: { connect: { id: scrim.id } },
        code: teamCode,
        TeamMember: {
          create: {
            userId: interaction.user.id,
            isCaptain: true,
            scrim: { connect: { id: scrim.id } },
            displayName: interaction.user.username,
          },
        },
      },
    });
    await interaction.reply({
      content: `Team "${newTeam.name}" created successfully! Your team code is: \`${newTeam.code}\`. Share this code with your teammates to join your team.`,
      flags: "Ephemeral",
    });
  }

  async disbandTeam(interaction: ChatInputCommandInteraction) {
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This channel is not associated with any scrim.",
        flags: "Ephemeral",
      });
      return;
    }
    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.reply({
        content: "Teams can only be disbanded during the registration stage.",
        flags: "Ephemeral",
      });
      return;
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        scrimId: scrim.id,
        isCaptain: true,
        userId: interaction.user.id,
      },
      include: { team: true },
    });

    if (!teamMember) {
      await interaction.reply({
        content:
          "You are not a captain of any team in this scrim. Only captains can disband teams.",
        flags: "Ephemeral",
      });
      return;
    }

    if (teamMember.team.registeredAt) {
      await interaction.reply({
        content:
          "You cannot disband a team that has already been registered for the scrim.",
        flags: "Ephemeral",
      });
      return;
    }

    await prisma.team.delete({
      where: { id: teamMember.teamId },
    });

    await interaction.reply({
      content: `Your team has been disbanded successfully.`,
      flags: "Ephemeral",
    });
  }

  async kickMember(interaction: ChatInputCommandInteraction) {
    const memberId = interaction.options.getString("memberid", true);
    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This channel is not associated with any scrim.",
        flags: "Ephemeral",
      });
      return;
    }
    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.reply({
        content: "Members can only be kicked during the registration stage.",
        flags: "Ephemeral",
      });
      return;
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        scrimId: scrim.id,
        isCaptain: true,
        userId: interaction.user.id,
      },
      include: { team: true },
    });

    if (!teamMember) {
      await interaction.reply({
        content:
          "You are not a captain of any team in this scrim. Only captains can kick members.",
        flags: "Ephemeral",
      });
      return;
    }

    if (teamMember.team.registeredAt) {
      await interaction.reply({
        content:
          "You cannot kick members from a team that has already been registered for the scrim.",
        flags: "Ephemeral",
      });
      return;
    }

    if (teamMember.userId === memberId) {
      await interaction.reply({
        content: "You cannot kick yourself from the team.",
        flags: "Ephemeral",
      });
      return;
    }

    const memberToKick = await prisma.teamMember.findFirst({
      where: { userId: memberId, teamId: teamMember.teamId },
    });

    if (!memberToKick) {
      await interaction.reply({
        content:
          "The specified member is not part of your team or does not exist.",
        flags: "Ephemeral",
      });
      return;
    }

    await prisma.teamMember.delete({
      where: { id: memberToKick.id },
    });

    await interaction.reply({
      content: `Member <@${memberId}> has been kicked from the team.`,
      flags: "Ephemeral",
    });
  }

  async joinTeam(interaction: ChatInputCommandInteraction) {
    const teamCode = interaction.options.getString("teamcode", true);
    const isSubstitute = interaction.options.getBoolean("substitute") ?? false;
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
    if (scrim.stage != Stage.REGISTRATION) {
      await interaction.reply({
        content: "Team registration is not open.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { code: teamCode.toLowerCase(), scrimId: scrim.id },
      include: { scrim: true, TeamMember: true },
    });

    if (!team) {
      await interaction.reply({
        content: "Invalid team code.",
        flags: ["Ephemeral"],
      });
      return;
    }

    if (scrim.maxPlayersPerTeam <= team.TeamMember.length) {
      await interaction.reply({
        content:
          "This team is already full. You may want to join as a substitute. Use `/jointeam <teamcode> true` to join as a substitute.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        scrimId_userId: {
          scrimId: scrim.id,
          userId: interaction.user.id,
        },
      },
    });

    if (existingMember) {
      await interaction.reply({
        content: "You are already in a team for this scrim.",
        flags: ["Ephemeral"],
      });
      return;
    }

    await prisma.teamMember.create({
      data: {
        displayName: interaction.user.username,
        teamId: team.id,
        scrimId: scrim.id,
        userId: interaction.user.id,
        isCaptain: false,
        isSubstitute,
      },
    });

    await interaction.reply({
      content: `You have joined the team **${team.name}**!`,
      flags: ["Ephemeral"],
    });
    const teamChannel = interaction.guild?.channels.cache.get(
      team.scrim.teamChannelId,
    );
    if (!teamChannel || !teamChannel.isTextBased()) {
      return;
    }
    if (!team.teamDetailsMessageId) {
      return;
    }
    const message = await teamChannel.messages.fetch(team.teamDetailsMessageId);
    if (!message) {
      return;
    }

    await message.edit({
      embeds: [await teamDetailsEmbed(team)],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name !== "memberid") return;

    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.respond([]);
      return;
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        scrimId: scrim.id,
        isCaptain: true,
        userId: interaction.user.id,
      },
    });

    if (!teamMember) {
      await interaction.respond([]);
      return;
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: teamMember.teamId },
    });

    const choices = teamMembers.map((member) => ({
      name: `${member.displayName} (${member.userId})`,
      value: member.userId,
    }));

    const filtered = choices.filter((choice) =>
      choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
    );

    await interaction.respond(filtered.slice(0, 25));
  }
}
