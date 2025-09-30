import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { editRegisteredTeamDetails } from "@/ui/messages/teams";
import { Team } from "@prisma/client";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

async function teamViewEmbed(team: Team) {
  const members = await prisma.teamMember.findMany({
    where: { teamId: team.id },
  });
  const memberList =
    members.map((m) => `<@${m.userId}>`).join("\n") || "No members";

  return new EmbedBuilder()
    .setTitle("Team View")
    .setDescription(`**Team Name:** ${team.name}\n**Members:**\n${memberList}`);
}

function registerComponent(selectedTeamId: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`register_the_team:${selectedTeamId}`)
        .setLabel("Register Team")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🛡️"),
      new ButtonBuilder()
        .setCustomId("back_to_team_menu")
        .setLabel("⬅️ Back")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function teamDropdown(teams: Team[]) {
  const options = teams
    .map((t) => ({
      label: t.name || "Unnamed Team",
      value: t.id.toString(),
    }))
    .slice(0, 25);

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("team_select")
        .setPlaceholder("Choose a team")
        .addOptions(options)
    ),
  ];
}

export default class RegisterTeam extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction): Promise<any> {
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "team_select"
    ) {
      return this.handleTeamSelect(interaction);
    }
    if (!interaction.isButton()) return;

    const [action, selectedTeamIdStr] = interaction.customId.split(":");
    const selectedTeamId = selectedTeamIdStr
      ? parseInt(selectedTeamIdStr, 10)
      : null;

    switch (action) {
      case "register_the_team":
        if (!selectedTeamId) {
          return interaction.reply({
            content: "No team selected to register.",
            flags: ["Ephemeral"],
          });
        }
        return this.handleRegister(interaction, selectedTeamId);
      case "back_to_team_menu":
      default:
        return this.showTeamMenu(interaction);
    }
  }

  private async handleTeamSelect(interaction: StringSelectMenuInteraction) {
    const teamId = parseInt(interaction.values[0]!, 10);
    if (!teamId) {
      return interaction.reply({
        content: "No team selected.",
        flags: ["Ephemeral"],
      });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return interaction.reply({
        content: "Selected team not found.",
        flags: ["Ephemeral"],
      });
    }

    const embed = await teamViewEmbed(team);
    const component = registerComponent(team.id); // store selected team here
    await interaction.update({ embeds: [embed], components: component });

    await prisma.team.updateMany({
      where: { userId: interaction.user.id },
      data: { messageId: interaction.message.id },
    });
  }

  private async handleRegister(
    interaction: ButtonInteraction,
    selectedTeamId: number
  ) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        flags: ["Ephemeral"],
      });
    }

    const scrim = await prisma.scrim.findFirst({
      where: { registrationChannelId: interaction.channelId, guildId },
    });
    if (!scrim) {
      return interaction.reply({
        content: "This channel is not set up for team registration.",
        flags: ["Ephemeral"],
      });
    }
    const team = await prisma.team.findUnique({
      where: { id: selectedTeamId },
    });
    if (!team) {
      return interaction.reply({
        content: "Selected team not found.",
        flags: ["Ephemeral"],
      });
    }
    const registeredTeam = await prisma.registeredTeam.findUnique({
      where: {
        scrimId_teamId: { scrimId: scrim.id, teamId: team.id },
      },
    });
    if (registeredTeam) {
      return interaction.reply({
        content: "This team is already registered for the scrim.",
        flags: ["Ephemeral"],
      });
    }

    const newRegisterTeam = await prisma.registeredTeam.create({
      data: { scrimId: scrim.id, teamId: team.id, name: team.name },
    });

    await interaction.reply({
      content: "Team successfully registered!",
      flags: ["Ephemeral"],
    });
  }

  private async showTeamMenu(interaction: ButtonInteraction) {
    const userId = interaction.user.id;
    const teams = await prisma.team.findMany({ where: { userId } });

    if (!teams.length) {
      return interaction.reply({
        content: "You have no teams to view. Please create one first.",
        flags: ["Ephemeral"],
      });
    }

    const embed = new EmbedBuilder().setTitle("Team Menu");
    const components = teamDropdown(teams);

    await interaction.reply({
      embeds: [embed],
      components,
      flags: ["Ephemeral"],
    });

    const msg = await interaction.fetchReply();
    await prisma.team.updateMany({
      where: { userId },
      data: { messageId: msg.id },
    });
  }
}
