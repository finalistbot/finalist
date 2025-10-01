import { Command } from "@/base/classes/command";
import { isUserBanned, isNotBanned } from "@/checks/banned";
import { ensureUser } from "@/database";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { randomString } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

const MAX_TEAM_SIZE = 10;

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
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(50),
        )
        .addStringOption((option) =>
          option
            .setName("ign")
            .setDescription("Your in-game name")
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(30),
        )
        .addStringOption((option) =>
          option
            .setName("tag")
            .setDescription("The tag of the team")
            .setRequired(false)
            .setMinLength(2)
            .setMaxLength(10),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("disband")
        .setDescription("Disband your team")
        .addIntegerOption((option) =>
          option
            .setName("team")
            .setDescription("The team to disband")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("kick")
        .setDescription("Kick a member from your team")
        .addIntegerOption((option) =>
          option
            .setName("team")
            .setDescription("The team to kick the member from")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName("member")
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
        .addStringOption((option) =>
          option
            .setName("ign")
            .setDescription("Your in-game name")
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(30),
        )
        .addBooleanOption((option) =>
          option
            .setName("substitute")
            .setDescription("Join as a substitute")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leave")
        .setDescription("Leave your current team")
        .addIntegerOption((option) =>
          option
            .setName("team")
            .setDescription("The team to leave")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Get info about your team")
        .addIntegerOption((option) =>
          option
            .setName("team")
            .setDescription("The team to get info about")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a member to your team")
        .addIntegerOption((option) =>
          option
            .setName("team")
            .setDescription("The team to add the member to")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addUserOption((option) =>
          option
            .setName("member")
            .setDescription("The member to add to your team")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("ign")
            .setDescription("The in-game name of the member")
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(30),
        ),
    );
  checks = [isNotBanned];
  info: CommandInfo = {
    name: "team",
    description: "Manage your team",
    usageExamples: [
      "/team create name:MyTeam ign:MyInGameName tag:MT",
      "/team disband team:<team_id>",
      "/team kick team:<team_id> member:<member_id>",
      "/team join teamcode:ABCDEFGH ign:MyInGameName substitute:false",
      "/team leave team:<team_id>",
      "/team info team:<team_id>",
      "/team add team:<team_id> member:@User ign:UserInGameName",
    ],
    category: "Esports",
    subcommands: [
      {
        name: "create",
        description: "Create a new team",
        options: [
          {
            name: "name",
            description: "The name of the team",
            type: "STRING",
            required: true,
          },
          {
            name: "ign",
            description: "Your in-game name",
            type: "STRING",
            required: true,
          },
          {
            name: "tag",
            description:
              "The tag of the team (useful to distinguish teams with the same name)",
            type: "STRING",
            required: false,
          },
        ],
      },
      {
        name: "disband",
        description: "Disband your team",
        options: [
          {
            name: "team",
            description: "The team to disband",
            type: "INTEGER",
            required: true,
          },
        ],
      },
      {
        name: "kick",
        description: "Kick a member from your team",
        options: [
          {
            name: "team",
            description: "The team to kick the member from",
            type: "INTEGER",
            required: true,
          },
          {
            name: "member",
            description: "The ID of the member to kick",
            type: "STRING",
            required: true,
          },
        ],
      },
      {
        name: "join",
        description: "Join a team using a team code",
        options: [
          {
            name: "teamcode",
            description: "The code of the team to join",
            type: "STRING",
            required: true,
          },
          {
            name: "ign",
            description: "Your in-game name",
            type: "STRING",
            required: true,
          },
          {
            name: "substitute",
            description: "Join as a substitute",

            type: "BOOLEAN",
            required: false,
          },
        ],
      },
      {
        name: "leave",
        description: "Leave your current team",
        options: [
          {
            name: "team",
            description: "The team to leave",
            type: "INTEGER",
            required: true,
          },
        ],
      },
      {
        name: "info",
        description: "Get info about your team",
        options: [
          {
            name: "team",
            description: "The team to get info about",
            type: "INTEGER",
            required: true,
          },
        ],
      },
      {
        name: "add",
        description: "Add a member to your team",
        options: [
          {
            name: "team",
            description: "The team to add the member to",
            type: "INTEGER",
            required: true,
          },
          {
            name: "member",
            description: "The member to add to your team",
            type: "USER",
            required: true,
          },
          {
            name: "ign",
            description: "The in-game name of the member",
            type: "STRING",
            required: true,
          },
        ],
      },
    ],
  };

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
      case "add":
        await this.addMember(interaction);
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
    await interaction.deferReply({ flags: "Ephemeral" });
    const isBanned = await isUserBanned(
      interaction.guildId,
      interaction.user.id,
    );
    if (isBanned) {
      await interaction.editReply({
        content: `You are banned from participating in this server`,
      });
      return;
    }
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: interaction.guildId },
    });
    const maxTeamsPerCaptain = guildConfig?.teamsPerCaptain || 1;
    const teamName = interaction.options.getString("name", true);
    const tag = interaction.options.getString("tag") || null;
    const ign = interaction.options.getString("ign", true);

    const existingTeam = await prisma.team.findFirst({
      where: { name: teamName, tag, guildId: interaction.guildId },
    });

    if (existingTeam) {
      await interaction.editReply({
        content: `A team with the name "${teamName}" and tag "${tag}" already exists. Please choose a different name or tag.`,
      });
      return;
    }

    const captainTeamsCount = await prisma.team.count({
      where: {
        guildId: interaction.guildId,
        teamMembers: {
          some: { userId: interaction.user.id, role: "CAPTAIN" },
        },
      },
    });

    if (captainTeamsCount >= maxTeamsPerCaptain) {
      await interaction.editReply({
        content: `You have reached the maximum number of teams (${maxTeamsPerCaptain}) you can create as a captain.`,
      });
      return;
    }

    const teamCode = randomString(8);
    await ensureUser(interaction.user);
    const newTeam = await prisma.team.create({
      data: {
        guildId: interaction.guildId!,
        name: teamName,
        code: teamCode,
        tag,
        teamMembers: {
          create: {
            ingameName: ign,
            userId: interaction.user.id,
            role: "CAPTAIN",
          },
        },
      },
    });
    await interaction.editReply({
      content: `Team "${newTeam.name}" created successfully! Your team code is: \`${newTeam.code}\`. Share this code with your teammates to join your team.`,
    });
  }

  async disbandTeam(interaction: ChatInputCommandInteraction) {
    const teamId = interaction.options.getInteger("team", true);
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: { some: { role: "CAPTAIN", userId: interaction.user.id } },
      },
    });
    if (!team) {
      await interaction.reply({
        content:
          "You are not the captain of this team or the team does not exist.",
        flags: "Ephemeral",
      });
      return;
    }
    if (team.banned) {
      await interaction.reply({
        content: "You cannot disband a team that is banned.",
        flags: "Ephemeral",
      });
      return;
    }
    const registeredIn = await prisma.registeredTeam.count({
      where: { teamId: team.id },
    });
    if (registeredIn > 0) {
      await interaction.reply({
        content:
          "You cannot disband a team that is registered for a scrim. Please contact staff for assistance.",
        flags: "Ephemeral",
      });
      return;
    }

    await prisma.team.delete({
      where: { id: teamId },
    });
    await interaction.reply({
      content: "Team disbanded successfully.",
      flags: "Ephemeral",
    });
  }

  async kickMember(interaction: ChatInputCommandInteraction) {
    const teamId = interaction.options.getInteger("team", true);
    const memberId = interaction.options.getString("member", true);
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: {
          some: { role: "CAPTAIN", userId: interaction.user.id },
        },
      },
    });
    if (!team) {
      await interaction.reply({
        content:
          "You are not the captain of this team or the team does not exist.",
        flags: "Ephemeral",
      });
      return;
    }

    const memberToKick = await prisma.teamMember.findFirst({
      where: { userId: memberId, teamId: team.id },
    });

    if (!memberToKick) {
      await interaction.reply({
        content:
          "The specified member is not part of your team or does not exist.",
        flags: "Ephemeral",
      });
      return;
    }
    if (memberToKick.role === "CAPTAIN") {
      await interaction.reply({
        content: "You cannot kick the captain of the team.",
        flags: "Ephemeral",
      });
      return;
    }
    if (team.banned) {
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
    let isSubstitute = interaction.options.getBoolean("substitute") ?? false;
    const ign = interaction.options.getString("ign", true);

    const team = await prisma.team.findUnique({
      where: { code: teamCode, guildId: interaction.guildId! },
      include: {
        teamMembers: true,
      },
    });

    if (!team) {
      await interaction.reply({
        content: "Invalid team code.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: {
        userId: interaction.user.id,
        teamId: team.id,
      },
    });

    if (existingMember) {
      await interaction.reply({
        content: "You are already in this team.",
        flags: ["Ephemeral"],
      });
      return;
    }

    // Check team size limit
    const currentTeamSize = team.teamMembers.length;
    if (currentTeamSize >= MAX_TEAM_SIZE) {
      await interaction.reply({
        content: `This team has reached the maximum size of ${MAX_TEAM_SIZE} players.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const role = isSubstitute ? "SUBSTITUTE" : "MEMBER";

    await ensureUser(interaction.user);
    const memberCount = await prisma.teamMember.count({
      where: { teamId: team.id },
    });

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: interaction.user.id,
        role,
        ingameName: ign,
        position: memberCount,
      },
    });

    await interaction.reply({
      content:
        `You have joined the team **${team.name}**!` +
        (isSubstitute ? " You joined as a substitute." : ""),
      flags: ["Ephemeral"],
    });
  }

  async leaveTeam(interaction: ChatInputCommandInteraction) {
    const teamId = interaction.options.getInteger("team", true);
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: interaction.user.id,
        team: { guildId: interaction.guildId! },
      },
      include: { team: true },
    });
    if (!teamMember) {
      await interaction.reply({
        content: "You are not part of this team.",
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

    if (teamMember.role === "CAPTAIN") {
      await interaction.reply({
        content:
          "You cannot leave the team as you are the captain. Please disband the team!",
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
    const teamId = interaction.options.getInteger("team", true);

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: {
          some: { userId: interaction.user.id },
        },
      },
      include: {
        teamMembers: {
          include: {
            user: true,
          },
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    if (!team) {
      await interaction.reply({
        content: "You are not part of this team or the team does not exist.",
        flags: "Ephemeral",
      });
      return;
    }

    // Separate members by role
    const captain = team.teamMembers.find((m) => m.role === "CAPTAIN");
    const members = team.teamMembers.filter((m) => m.role === "MEMBER");
    const substitutes = team.teamMembers.filter((m) => m.role === "SUBSTITUTE");

    // Build member lists
    let membersText = "";
    if (captain) {
      membersText += `**Captain:**\n<@${captain.userId}> - ${captain.ingameName}\n\n`;
    }

    if (members.length > 0) {
      membersText += `**Members:** (${members.length})\n`;
      members.forEach((member, index) => {
        membersText += `${index + 1}. <@${member.userId}> - ${member.ingameName}\n`;
      });
      membersText += "\n";
    }

    if (substitutes.length > 0) {
      membersText += `**Substitutes:** (${substitutes.length})\n`;
      substitutes.forEach((sub, index) => {
        membersText += `${index + 1}. <@${sub.userId}> - ${sub.ingameName}\n`;
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${team.name}${team.tag ? ` [${team.tag}]` : ""}`)
      .setColor(team.banned ? 0xff0000 : BRAND_COLOR)
      .setDescription(membersText || "No members found.")
      .addFields(
        { name: "Team Code", value: `\`${team.code}\``, inline: true },
        {
          name: "Total Members",
          value: `${team.teamMembers.length}/${MAX_TEAM_SIZE}`,
          inline: true,
        },
        {
          name: "Status",
          value: team.banned ? "🚫 Banned" : "✅ Active",
          inline: true,
        },
      )
      .setFooter({ text: `Team ID: ${team.id}` })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: "Ephemeral",
    });
  }

  async addMember(interaction: ChatInputCommandInteraction) {
    const teamId = interaction.options.getInteger("team", true);
    const member = interaction.options.getUser("member", true);
    const ign = interaction.options.getString("ign", true);

    if (member.bot) {
      await interaction.reply({
        content: "You cannot add a bot as a team member.",
        flags: "Ephemeral",
      });
      return;
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        guildId: interaction.guildId!,
        teamMembers: { some: { role: "CAPTAIN", userId: interaction.user.id } },
      },
      include: {
        teamMembers: true,
      },
    });

    if (!team) {
      await interaction.reply({
        content:
          "You are not the captain of this team or the team does not exist.",
        flags: "Ephemeral",
      });
      return;
    }

    // Check team size limit
    const currentTeamSize = team.teamMembers.length;
    if (currentTeamSize >= MAX_TEAM_SIZE) {
      await interaction.reply({
        content: `Your team has reached the maximum size of ${MAX_TEAM_SIZE} players.`,
        flags: "Ephemeral",
      });
      return;
    }

    const bannedUser = await prisma.bannedUser.findFirst({
      where: { userId: member.id, guildId: interaction.guildId! },
    });
    if (bannedUser) {
      await interaction.reply({
        content: `This user is banned from participating in this server. Reason: ${bannedUser.reason}`,
        flags: "Ephemeral",
      });
      return;
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: {
        userId: member.id,
        teamId: team.id,
      },
    });

    if (existingMember) {
      await interaction.reply({
        content: "This user is already in your team.",
        flags: "Ephemeral",
      });
      return;
    }

    await ensureUser(member);
    const memberCount = await prisma.teamMember.count({
      where: { teamId: team.id },
    });

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: member.id,
        role: "MEMBER",
        ingameName: ign,
        position: memberCount,
      },
    });

    await interaction.reply({
      content: `User <@${member.id}> has been added to your team **${team.name}**! (${currentTeamSize + 1}/${MAX_TEAM_SIZE})`,
      flags: "Ephemeral",
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    let choices: { name: string; value: number | string }[] = [];

    switch (subcommand) {
      case "disband":
      case "leave":
      case "info":
      case "add": {
        const focusedValue = interaction.options.getFocused();
        const teams = await prisma.team.findMany({
          where: {
            guildId: interaction.guildId!,
            teamMembers: { some: { userId: interaction.user.id } },
            name: focusedValue
              ? { contains: focusedValue, mode: "insensitive" }
              : {},
          },
          take: 25,
        });
        choices = teams.map((team) => ({
          name: team.name,
          value: team.id,
        }));
        break;
      }
      case "kick": {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === "team") {
          const focusedValue = interaction.options.getFocused();
          const teams = await prisma.team.findMany({
            where: {
              guildId: interaction.guildId!,
              teamMembers: {
                some: {
                  userId: interaction.user.id,
                  role: "CAPTAIN",
                },
              },
              name: { contains: focusedValue, mode: "insensitive" },
            },
            take: 25,
          });
          choices = teams.map((team) => ({
            name: team.name,
            value: team.id,
          }));
        } else if (focusedOption.name === "member") {
          const teamId = interaction.options.getInteger("team");
          if (!teamId) break;

          const focusedValue = interaction.options.getFocused();
          const members = await prisma.teamMember.findMany({
            where: {
              teamId,
              role: { not: "CAPTAIN" },
              user: {
                name: { contains: focusedValue, mode: "insensitive" },
              },
            },
            include: { user: true },
            take: 25,
          });
          choices = members.map((member) => ({
            name: `${member.user.name} (${member.ingameName})`,
            value: member.userId,
          }));
        }
        break;
      }
    }

    await interaction.respond(choices);
  }
}
