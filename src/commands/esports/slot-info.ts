import { Command } from "@/base/classes/command";

import { isScrimAdmin } from "@/checks/scrim-admin";
import { BRAND_COLOR } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { safeRunChecks, suppress } from "@/lib/utils";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export default class SlotlistInfo extends Command {
  data = new SlashCommandBuilder()
    .setName("slot-info")
    .setDescription("Get information about a specific slot")

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to get the slot information for")
        .setRequired(true),
    );
  info = {
    name: "slot-info",
    description: "Get information about a specific slot.",
    longDescription:
      "Retrieve detailed information about a specific slot in a scrim, including the user assigned to the slot, their team, and role.",
    usageExamples: ["/slot-info user:@username"],
    category: "Esports",
    options: [
      {
        name: "user",
        description: "The user to get the slot information for",
        type: "USER",
        required: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    if (!interaction.isChatInputCommand()) return;
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.reply({
        content: checkResult.reason,
      });
      return;
    }
    const user = interaction.options.getUser("user", true);
    if (user.bot) {
      await interaction.reply({
        content: "Bots cannot be registered in teams.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.reply({
        content:
          "No scrim found associated with this channel. Please use this command in a scrim admin channel.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const teamMember = await prisma.teamMember.findFirst({
      where: { scrimId: scrim.id, userId: user.id },
      include: { team: true },
    });
    if (!teamMember) {
      await interaction.reply({
        content: `User ${user.tag} is not registered in any team for this scrim.`,
        flags: ["Ephemeral"],
      });
      return;
    }
    const assignedSlot = await prisma.assignedSlot.findFirst({
      where: { scrimId: scrim.id, teamId: teamMember.teamId },
    });
    let role = "👤 Player";
    if (teamMember.isCaptain) {
      role = "👑 Captain";
    } else if (teamMember.isSubstitute) {
      role = "🟡 Substitute";
    }
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`👤 Player: ${user.tag} (ID: ${user.id})`)
      .setAuthor({
        name: "Scrim Slot Details",
        iconURL: "https://i.postimg.cc/dVJBqmqv/Finalist.png",
      })
      .setThumbnail(user.displayAvatarURL({ size: 1024 }))
      .setDescription(`**Scrim:** ${scrim.name} (\`${scrim.id}\`)`)
      .addFields(
        {
          name: "🛡️ Team",
          value: `${teamMember.team.name} (\`${teamMember.team.id}\`)`,
          inline: true,
        },
        {
          name: "🎖️ Role",
          value: role,
          inline: true,
        },
        {
          name: "🎟️ Assigned Slot",
          value: assignedSlot
            ? `Slot Number: **${assignedSlot.slotNumber}**`
            : "No slot assigned",
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({
        text: "Slot information",
        iconURL: "https://i.postimg.cc/dVJBqmqv/Finalist.png",
      });

    await interaction.reply({ embeds: [embed], flags: ["Ephemeral"] });
  }
}
