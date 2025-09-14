import { Command } from "@/base/classes/command";
import { isUserBanned, checkIsNotBanned } from "@/checks/banned";
import { prisma } from "@/lib/prisma";
import { convertToTitleCase, randomString } from "@/lib/utils";
import { Stage } from "@prisma/client";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { teamDetailsEmbed } from "@/ui/embeds/team-details";

export default class TeamCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("team")
    .setDescription("Manage your team")
    .setContexts(InteractionContextType.Guild)
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
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leave").setDescription("Leave your current team"),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("info").setDescription("Get info about your team"),
    );

  checks = [checkIsNotBanned];

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
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
      case "leave":
        await this.leaveTeam(interaction);
        break;
      case "info":
        await this.teamInfo(interaction);
        break;
      default:
        await interaction.reply({
          content: "Unknown subcommand.",
          flags: "Ephemeral",
        });
        return;
    }
  }

  async createTeam(interaction: ChatInputCommandInteraction<"cached">) {
    const isBanned = await isUserBanned(
      interaction.guildId,
      interaction.user.id,
    );
    if (isBanned) {
      await interaction.reply({
        content: `You are banned from participating in this server`,
        flags: "Ephemeral",
      });
      return;
    }
    const teamName = convertToTitleCase(
      interaction.options.getString("name", true),
    );
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
    if (teamMember.team.banned) {
      await interaction.reply({
        content: "You cannot kick members from a team that is banned.",
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
    const bannedUser = await prisma.bannedUser.findFirst({
      where: { userId: interaction.user.id, guildId: interaction.guildId! },
    });
    if (bannedUser) {
      await interaction.reply({
        content: `You are banned from participating in this server. Reason: ${bannedUser.reason}`,
        flags: "Ephemeral",
      });
      return;
    }
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
      where: { code: teamCode, scrimId: scrim.id },
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
  async leaveTeam(interaction: ChatInputCommandInteraction) {
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
        content: "You can only leave a team during the registration stage.",
        flags: "Ephemeral",
      });
      return;
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: { scrimId: scrim.id, userId: interaction.user.id },
      include: { team: true },
    });

    if (!teamMember) {
      await interaction.reply({
        content: "You are not part of any team in this scrim.",
        flags: "Ephemeral",
      });
      return;
    }

    if (teamMember.team.banned) {
      await interaction.reply({
        content: "You cannot leave a team that is banned.",
        flags: "Ephemeral",
      });
      return;
    }

    if (teamMember.isCaptain) {
      await interaction.reply({
        content:
          "You cannot leave the team as you are the captain. Please disband the team!!",
        flags: "Ephemeral",
      });
      return;
    }

    if (teamMember.team.registeredAt) {
      await interaction.reply({
        content:
          "You cannot leave a team that has already been registered for the scrim.",
        flags: "Ephemeral",
      });
      return;
    }

    await prisma.teamMember.delete({
      where: { id: teamMember.id },
    });

    await interaction.reply({
      content: `You have left the team "${teamMember.team.name}".`,
      flags: "Ephemeral",
    });
  }
  async teamInfo(interaction: ChatInputCommandInteraction) {
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

    const teamMember = await prisma.teamMember.findFirst({
      where: { scrimId: scrim.id, userId: interaction.user.id },
      include: { team: { include: { TeamMember: true } } },
    });

    if (!teamMember) {
      await interaction.reply({
        content: "You are not part of any team in this scrim.",
        flags: "Ephemeral",
      });
      return;
    }
    const embed = await teamDetailsEmbed(teamMember.team);
    await interaction.reply({
      embeds: [embed],
      flags: "Ephemeral",
    });
  }
}
