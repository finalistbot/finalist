import { Command } from "@/base/classes/command";
import { botHasPermissions } from "@/checks/permissions";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { safeRunChecks } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class ReserveSlotCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("reserve-slot")
    .setDescription("Reserve a slot for a scrim")
    .addUserOption((option) =>
      option
        .setName("team-leader")
        .setDescription("The team leader of the team to reserve the slot for")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("slot-number")
        .setDescription("The slot number to reserve")
        .setRequired(true),
    );

  info: CommandInfo = {
    name: "reserve-slot",
    description: "Reserve a slot for a scrim.",
    category: "Esports",
    longDescription:
      "Reserve a slot for a scrim in the admin channel. This is useful for ensuring that certain teams have a guaranteed spot in the scrim.",
    usageExamples: [
      "/reserve-slot team-leader:@player slot-number:1",
      "(in scrim admin channel) /reserve-slot team-leader:@player slot-number:1",
    ],
    options: [
      {
        name: "team-leader",
        description: "The team leader of the team to reserve the slot for",
        type: "USER",
        required: true,
      },
      {
        name: "slot-number",
        description: "The slot number to reserve",
        type: "INTEGER",
        required: true,
      },
    ],
  };

  checks = [botHasPermissions("SendMessages", "EmbedLinks")];
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }
    const teamLeader = interaction.options.getUser("team-leader", true);
    const slotNumber = interaction.options.getInteger("slot-number", true);
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can be used only in admin channel.",
      });
      return;
    }
    await prisma.reservedSlot.create({
      data: {
        userId: teamLeader.id,
        scrimId: scrim.id,
        slotNumber,
      },
    });
    await interaction.editReply(
      `Slot number ${slotNumber} has been reserved for team leader ${teamLeader.tag}.`,
    );
  }
}
