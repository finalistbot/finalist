import { Command } from "@/base/classes/command";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
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

  checks = [checkIsScrimAdmin];
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const teamLeader = interaction.options.getUser("team-leader", true);
    const slotNumber = interaction.options.getInteger("slot-number", true);
    const scrim = await prisma.scrim.findFirst({
      where: { adminChannelId: interaction.channelId },
    });
    if (!scrim) {
      await interaction.reply({
        content: "This command can be used only in admin channel.",
        flags: "Ephemeral",
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
    await interaction.reply(
      `Slot number ${slotNumber} has been reserved for team leader ${teamLeader.tag}.`,
    );
  }
}
