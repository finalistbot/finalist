import { Command } from "@/base/classes/command";
import { BracketError } from "@/base/classes/error";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import { Stage } from "@prisma/client";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

export default class EndScrim extends Command {
  data = new SlashCommandBuilder()
    .setName("end")
    .setDescription("End a scrim")
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option
        .setName("scrim")
        .setDescription("Scrim to end")
        .setRequired(true)
        .setAutocomplete(true),
    );
  info: CommandInfo = {
    name: "end",
    description: "End a scrim.",
    longDescription: "End an existing scrim by specifying its name.",
    usageExamples: ["/end name:My Scrim"],
    category: "Esports",
    options: [
      {
        name: "name",
        description: "Name of the scrim",
        type: "STRING",
        required: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const scrimId = interaction.options.getInteger("scrim", true);
    const guildId = interaction.guildId;
    if (!guildId) throw new BracketError("Guild ID not found");

    const scrim = await prisma.scrim.findFirst({
      where: {
        id: scrimId,
        guildId: guildId,
      },
    });
    if (!scrim) throw new BracketError("Scrim not found");

    if (scrim.stage in ([Stage.COMPLETED, Stage.CANCELED] as const))
      throw new BracketError("This scrim has already been ended");
    await prisma.scrim.update({
      where: { id: scrim.id },
      data: { stage: Stage.COMPLETED },
    });
    return interaction.editReply({
      content: `Scrim **${scrim.name}** has been ended.`,
    });
  }
  async autocomplete(interaction: AutocompleteInteraction<"cached">) {
    // FIXME: DRY with delete command and stage in query
    if (!interaction.inGuild()) return [];
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name !== "id") {
      return;
    }
    const search = focusedOption.value.toString();
    let scrims: { id: number; name: string }[] = [];
    if (search.length < 1) {
      scrims = await prisma.scrim.findMany({
        where: { guildId: interaction.guildId, stage: Stage.ONGOING },
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
