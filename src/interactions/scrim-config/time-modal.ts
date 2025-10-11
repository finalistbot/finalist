import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { prisma } from "@/lib/prisma";
import { Scrim } from "@prisma/client";
import * as dateFns from "date-fns";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { IdentityInteraction } from "@/base/classes/identity-interaction";
import z from "zod";

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
  autocleanTime: z.string().transform((val, ctx) => {
    const parsed = dateFns.parse(val, "HH:mm", new Date());
    const isValid = dateFns.isValid(parsed);
    if (!isValid) {
      ctx.addIssue({
        code: "invalid_value",
        expected: "valid time string",
        received: "invalid time string",
        values: [val],
        message: "Invalid time format. Please use HH:MM (24-hour)",
      });
      return z.NEVER;
    }
    return parsed;
  }),
});

async function timingConfigModal(scrim: Scrim) {
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { id: scrim.guildId },
  });
  const input = new TextInputBuilder()
    .setCustomId("registrationStartTime")

    .setStyle(TextInputStyle.Short)
    .setMinLength(16)
    .setMaxLength(16)
    .setRequired(true)
    .setPlaceholder("e.g., 2024-12-31 15:30");

  const zonedRegistrationTime = toZonedTime(
    scrim.registrationStartTime,
    guildConfig?.timezone || "UTC",
  );
  const autocleanTime = toZonedTime(
    scrim.autocleanTime,
    guildConfig?.timezone || "UTC",
  );
  input.setValue(dateFns.format(zonedRegistrationTime, "yyyy-MM-dd HH:mm"));
  return new ModalBuilder()
    .setCustomId(`scrim_timing_config_submit:${scrim.id}`)
    .setTitle("Scrim Timing Configuration")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Registration Time (YYYY-MM-DD HH:MM)")
        .setDescription(
          `Time when team registrations open. (Timezone: ${
            guildConfig?.timezone || "UTC"
          })`,
        )
        .setTextInputComponent(input),
      new LabelBuilder()
        .setLabel("Cleanup Time (HH:MM)")
        .setDescription(
          `Daily time to clean up old scrims. (Timezone: ${
            guildConfig?.timezone || "UTC"
          }) Leave blank to disable.`,
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("autoCleanTime")
            .setStyle(TextInputStyle.Short)
            .setMinLength(5)
            .setMaxLength(5)
            .setRequired(false)
            .setPlaceholder("e.g., 03:00")
            .setValue(dateFns.format(autocleanTime, "HH:mm")),
        ),
    );
}

export default class ScrimTimingConfig extends IdentityInteraction<"button"> {
  id = "show_scrim_timing_config_modal";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.reply({
        content: "Invalid scrim ID.",
        flags: "Ephemeral",
      });
      return;
    }
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.reply({
        content: checkResult.reason,
        flags: "Ephemeral",
      });
      return;
    }
    let scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      await interaction.reply({
        content: "Scrim not found.",
        flags: "Ephemeral",
      });
      return;
    }
    const modal = await timingConfigModal(scrim);
    await interaction.showModal(modal);
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
    });

    const rawBody = {
      registrationStartTime: modalSubmit.fields.getTextInputValue(
        "registrationStartTime",
      ),
      dailyAutoCleanTime: modalSubmit.fields.getTextInputValue("autoCleanTime"),
    };

    await modalSubmit.deferReply({ flags: "Ephemeral" });

    const parsed = TimingConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await modalSubmit.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: interaction.guildId! },
    });
    const data = parsed.data;
    data.registrationStartTime = fromZonedTime(
      data.registrationStartTime,
      guildConfig?.timezone || "UTC",
    );
    data.autocleanTime = fromZonedTime(
      data.autocleanTime,
      guildConfig?.timezone || "UTC",
    );
    if (dateFns.isBefore(data.registrationStartTime, new Date())) {
      await modalSubmit.editReply({
        content: "Registration start time must be in the future.",
      });
      return;
    }
    const fixedDate = new Date(0);
    data.autocleanTime = dateFns.set(fixedDate, {
      hours: dateFns.getHours(data.autocleanTime),
      minutes: dateFns.getMinutes(data.autocleanTime),
      seconds: 0,
      milliseconds: 0,
    });
    scrim = await prisma.scrim.update({
      where: {
        id: scrimId,
      },
      data: {
        registrationStartTime: data.registrationStartTime,
        autocleanTime: data.autocleanTime,
      },
    });
    await modalSubmit.editReply({
      content: "Scrim timing configuration updated successfully.",
    });
    await Promise.all([
      this.client.scrimService.scheduleRegistrationStart(scrim),
      this.client.scrimService.scheduleAutoCleanup(scrim),
      this.client.scrimService.updateScrimConfigMessage(scrim),
    ]);
  }
}
