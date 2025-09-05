import { Command } from "@/base/classes/command";
import { checkIsScrimAdmin } from "@/checks/scrim-admin";
import { rest } from "@/lib/discord-rest";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { Scrim, Stage } from "@prisma/client";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

export default class ScrimDelete extends Command {
  data = new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete a scrim")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("The ID of the scrim to delete")
        .setAutocomplete(true),
    );
  checks = [checkIsScrimAdmin];
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const scrimId = interaction.options.getInteger("id");
    let scrim: Scrim | null = null;
    if (scrimId === null) {
      scrim = await prisma.scrim.findFirst({
        where: { adminChannelId: interaction.channelId },
      });
      if (!scrim) {
        return await interaction.reply({
          content:
            "Could not find a scrim associated with this channel. Please provide a scrim ID.",
          flags: "Ephemeral",
        });
      }
    } else {
      scrim = await prisma.scrim.findUnique({
        where: { id: scrimId },
      });
      if (!scrim) {
        return await interaction.reply({
          content: `Could not find a scrim with ID ${scrimId}.`,
          flags: "Ephemeral",
        });
      }
    }
    if (scrim.stage != Stage.CONFIGURATION) {
      return await interaction.reply({
        content: `Cannot delete scrim with ID ${scrim.id} because it is already started.`,
        flags: "Ephemeral",
      });
    }
    await interaction.deferReply({ flags: "Ephemeral" });
    const deletableChannels = [
      scrim.adminChannelId,
      scrim.registrationChannelId,
      scrim.logsChannelId,
      scrim.teamsChannelId,
      scrim.discordCategoryId,
    ];
    await Promise.allSettled(
      deletableChannels.map((channelId) =>
        rest.delete(Routes.channel(channelId)),
      ),
    );

    await prisma.scrim.delete({ where: { id: scrim.id } });
    await suppress(
      interaction.editReply({
        content: `Scrim with ID ${scrim.id} has been deleted.`,
      }),
    );
  }

  async autocomplete(interaction: AutocompleteInteraction<"cached">) {
    if (!interaction.inGuild()) return [];
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name !== "id") {
      return;
    }
    const search = focusedOption.value.toString();
    let scrims: { id: number; name: string }[] = [];
    if (search.length < 1) {
      scrims = await prisma.scrim.findMany({
        where: { guildId: interaction.guildId },
        take: 25,
        select: { id: true, name: true },
      });
    } else {
      scrims = await prisma.$queryRaw<{ id: number; name: string }[]>`
        SELECT id, name FROM "Scrim" WHERE "guildId" = ${interaction.guildId} 
          AND SIMILARITY(name, ${search}) > 0.1
            ORDER BY SIMILARITY(name, ${search}) DESC LIMIT 25;`;
    }
    let isAdmin = await suppress(checkIsScrimAdmin(interaction), false);

    if (!isAdmin) {
      await interaction.respond([]);
      return;
    }

    await interaction.respond(
      scrims.map((scrim) => ({
        name: `${scrim.id}: ${scrim.name}`,
        value: scrim.id,
      })),
    );
  }
}
