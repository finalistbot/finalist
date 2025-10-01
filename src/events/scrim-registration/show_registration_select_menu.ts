import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  Interaction,
  CacheType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Embed,
  EmbedBuilder,
} from "discord.js";
export default class ShowRegistrationSelectMenu extends Event<"interactionCreate"> {
  event = "interactionCreate" as const;
  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_registration_select_menu") return;
    if (!interaction.inGuild()) return;
    await interaction.deferReply({ flags: "Ephemeral" });
    const scrim = await prisma.scrim.findFirst({
      where: {
        registrationChannelId: interaction.channelId,
      },
    });
    if (!scrim) return;
    const alreadyRegistered = await prisma.registeredTeamMember.findFirst({
      where: {
        userId: interaction.user.id,
        registeredTeam: {
          scrimId: scrim.id,
        },
      },
    });
    if (alreadyRegistered) {
      await interaction.editReply({
        content: "You are already registered for this scrim.",
      });
      return;
    }
    const teams = await prisma.team.findMany({
      where: {
        guildId: interaction.guildId,
        teamMembers: {
          some: { userId: interaction.user.id, role: "CAPTAIN" },
        },
      },
    });

    if (teams.length === 0) {
      await interaction.editReply({
        content:
          "You are not a captain of any team in this server. You must be a captain to register for a scrim.",
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Register for Scrim")
      .setDescription("Select a team to register for the scrim:")
      .setColor(BRAND_COLOR);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_team_for_registration`)
        .setPlaceholder("Select a team to register")
        .addOptions(
          teams.map((team) => ({
            label: team.name,
            description: `Register ${team.name} for the scrim`,
            value: team.id.toString(),
          }))
        )
    );
    await interaction.editReply({
      content: "Select a team to register for the scrim:",
      embeds: [embed],
      components: [row],
    });
  }
}
