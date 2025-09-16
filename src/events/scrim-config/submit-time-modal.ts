import { z } from "zod";
import * as dateFns from "date-fns";
import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { editScrimConfigEmbed } from "@/ui/messages/scrim-config";
import { parseIdFromString } from "@/lib/utils";

const TimingConfigSchema = z.object({
  registrationStartTime: z.string().transform((val, ctx) => {
    const parsed = dateFns.parse(val, "yyyy-MM-dd HH:mm", new Date());
    const isValid = dateFns.isValid(parsed);
    if (!isValid) {
      ctx.addIssue({
        code: "invalid_value",
        expected: "valid date string",
        received: "invalid date string",
        values: [val],
        message: "Invalid date format. Please use YYYY-MM-DD HH:MM (24-hour)",
      });
      return z.NEVER;
    }
    return parsed;
  }),
});

export default class TimingConfigSubmit extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;
  async execute(interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("scrim_timing_config_submit")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      return;
    }
    const rawBody = {
      registrationStartTime: interaction.fields.getTextInputValue(
        "registrationStartTime",
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
    if (dateFns.isBefore(data.registrationStartTime, new Date())) {
      await interaction.reply({
        content: "Registration start time must be in the future.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const scrim = await prisma.scrim.update({
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
    await this.client.scrimService.scheduleRegistrationStart(scrim);
  }
}
