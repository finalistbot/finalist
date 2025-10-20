import { Command } from "@/base/classes/command";
import { botHasPermissions } from "@/checks/permissions";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { safeRunChecks } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class FillSlotsCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("fillslots")
    .setDescription("Fill remaining slots for a scrim")
    .addStringOption((option) =>
      option
        .addChoices(
          { name: "Normal", value: "Normal" },
          { name: "Random", value: "Random" }
        )
        .setName("filling-method")
        .setDescription("The method to use for filling the slots")
        .setRequired(true)
    );

  info: CommandInfo = {
    name: "fillslots",
    description: "Fill remaining slots for a scrim.",
    category: "Esports",
    longDescription:
      "Fill remaining slots for a scrim in the admin channel. This is useful for quickly filling up a scrim with random players or normal queue players.",
    usageExamples: [
      "/fillslots filling-method:Normal",
      "/fillslots filling-method:Random",
      "(in scrim admin channel) /fillslots filling-method:Normal",
    ],
    options: [
      {
        name: "filling-method",
        description: "The method to use for filling the slots",
        type: "STRING",
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
    const fillingMethod = interaction.options.getString("filling-method", true);
    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId!,
      },
    });
    if (!scrim) {
      await interaction.editReply({
        content: "This command can only be used in a scrim admin channel.",
      });
      return;
    }
    await interaction.editReply({
      content: `Filling slots using **${fillingMethod}** method. Might take a while...`,
    });
    await this.client.scrimService.fillSlotList(
      scrim,
      fillingMethod as "normal" | "random"
    );
    await interaction.editReply({
      content: `Finished filling slots using **${fillingMethod}** method.`,
    });
  }
}
