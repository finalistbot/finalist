import { z } from "zod";
import * as dateFns from "date-fns";
import { Interaction } from "discord.js";
import { Event } from "@/base/classes/event";
import { prisma } from "@/lib/prisma";
import { parseIdFromString } from "@/lib/utils";
import { fromZonedTime } from "date-fns-tz";

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

    await interaction.deferReply({ flags: "Ephemeral" });

    const parsed = TimingConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });
    const data = parsed.data;
    data.registrationStartTime = fromZonedTime(
      data.registrationStartTime,
      guildConfig?.timezone || "UTC",
    );
    if (dateFns.isBefore(data.registrationStartTime, new Date())) {
      await interaction.editReply({
        content: "Registration start time must be in the future.",
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
    await interaction.editReply({
      content: "Scrim timing configuration updated successfully.",
    });
    await this.client.scrimService.scheduleRegistrationStart(scrim);
    await this.client.scrimService.updateScrimConfigMessage(scrim);
  }
}
