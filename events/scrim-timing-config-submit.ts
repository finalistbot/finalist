import { z } from "zod";
import * as dateFns from "date-fns";
import { BracketClient } from "../base/classes/client";
import { Events, Interaction } from "discord.js";
import { Event } from "../base/classes/event";
import { prisma } from "../lib/prisma";

const TimingConfigSchema = z.object({
  registrationStartTime: z.string().transform((val, ctx) => {
    const parsed = dateFns.parse(val, "yyyy-MM-dd HH:mm", new Date());
    const isValid = dateFns.isValid(parsed);
    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid date format. Please use YYYY-MM-DD HH:MM (24-hour)",
      });
      return z.NEVER;
    }
    return parsed;
  }),
});

export default class TimingConfigSubmit extends Event {
  constructor(client: BracketClient) {
    super(client, { event: Events.InteractionCreate, once: false });
  }
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("scrim_timing_config_submit")) return;
    const [_, _scrimId] = interaction.customId.split(":");
    if (!_scrimId) {
      return;
    }
    const scrimId = parseInt(_scrimId);
    if (isNaN(scrimId)) {
      return;
    }
    const rawBody = {
      registrationStartTime: interaction.fields.getTextInputValue(
        "registrationStartTime"
      ),
    };

    const parsed = TimingConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.reply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
        flags: ["Ephemeral"],
      });
      return;
    }
    const data = parsed.data;
    await prisma.scrim.update({
      where: {
        id: scrimId,
      },
      data: {
        registrationStartTime: data.registrationStartTime,
      },
    });
    await interaction.reply({
      content: "Scrim timing configuration updated successfully.",
      flags: ["Ephemeral"],
    });
  }
}
