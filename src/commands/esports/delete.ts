import { Command } from "@/base/classes/command";
import { botHasPermissions } from "@/checks/permissions";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { rest } from "@/lib/discord-rest";
import { prisma } from "@/lib/prisma";
import { safeRunChecks, suppress } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
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
  info: CommandInfo = {
    name: "delete",
    description: "Delete a scrim.",
    longDescription:
      "Delete a scrim and all associated channels. Only scrims that have not yet started can be deleted.",
    usageExamples: ["/delete id:12345", "/delete (in scrim admin channel)"],
    category: "Esports",
    options: [
      {
        name: "id",
        description: "The ID of the scrim to delete",
        type: "INTEGER",
        required: false,
      },
    ],
  };
  checks = [botHasPermissions("ManageChannels", "ManageRoles")];
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const result = await safeRunChecks(interaction, isScrimAdmin);
    if (!result.success) {
      await interaction.editReply({
        content: result.reason,
      });
      return;
    }
    const scrimId = interaction.options.getInteger("id");
    let scrim: Scrim | null = null;

    if (scrimId === null) {
      scrim = await prisma.scrim.findFirst({
        where: { adminChannelId: interaction.channelId },
      });
      if (!scrim) {
        return await interaction.editReply({
          content:
            "Could not find a scrim associated with this channel. Please provide a scrim ID.",
        });
      }
    } else {
      scrim = await prisma.scrim.findUnique({
        where: { id: scrimId },
      });
      if (!scrim) {
        return await interaction.editReply({
          content: `Could not find a scrim with ID ${scrimId}.`,
        });
      }
    }
    if (([Stage.ONGOING, Stage.COMPLETED] as Stage[]).includes(scrim.stage)) {
      return await interaction.editReply({
        content: `Scrim with ID ${scrim.id} is already ${scrim.stage.toLowerCase()} and cannot be deleted.`,
      });
    }
    const deletableChannels = [
      scrim.adminChannelId,
      scrim.registrationChannelId,
      scrim.logsChannelId,
      scrim.participantsChannelId,
      scrim.discordCategoryId,
    ];

    await Promise.allSettled(
      deletableChannels.map((channelId) =>
        rest.delete(Routes.channel(channelId)),
      ),
    );

    const guild = await this.client.guilds.fetch(scrim.guildId);
    if (!guild) {
      return;
    }
    await suppress(
      this.client.rolemanageService.deleteParticipantRole(guild, scrim),
    );

    await prisma.scrim.delete({ where: { id: scrim.id } });

    await interaction.editReply({
      content: `Scrim with ID ${scrim.id} has been deleted.`,
    });
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
        SELECT id, name FROM scrim WHERE guild_id = ${interaction.guildId} 
          AND SIMILARITY(name, ${search}) > 0.1
            ORDER BY SIMILARITY(name, ${search}) DESC LIMIT 25;`;
    }
    let isAdmin = await suppress(isScrimAdmin(interaction), false);

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
