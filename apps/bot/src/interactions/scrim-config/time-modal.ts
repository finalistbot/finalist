import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { Scrim } from "@prisma/client";
import * as dateFns from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { v4 as uuid4 } from "uuid";
import z from "zod";

import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";

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
  dailyAutocleanTime: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val) return null;
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

  if (scrim.registrationStartTime) {
    const zonedRegistrationTime = toZonedTime(
      scrim.registrationStartTime,
      guildConfig?.timezone || "UTC"
    );
    input.setValue(dateFns.format(zonedRegistrationTime, "yyyy-MM-dd HH:mm"));
  }
  return new ModalBuilder()
    .setTitle("Scrim Timing Configuration")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Registration Time (YYYY-MM-DD HH:MM)")
        .setDescription(
          `Time when team registrations open. (Timezone: ${
            guildConfig?.timezone || "UTC"
          })`
        )
        .setTextInputComponent(input),
      new LabelBuilder()
        .setLabel("Daily Autoclean Time (HH:MM)")
        .setDescription(
          `Deletes messages and participant roles daily at this time. Leave blank to disable (single scrim)`
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("dailyAutocleanTime")
            .setStyle(TextInputStyle.Short)
            .setMinLength(5)
            .setMaxLength(5)
            .setRequired(false)
            .setPlaceholder("e.g., 23:00")
            .setValue(
              scrim.autocleanTime
                ? dateFns.format(
                    toZonedTime(
                      scrim.autocleanTime,
                      guildConfig?.timezone || "UTC"
                    ),
                    "HH:mm"
                  )
                : ""
            )
        )
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
    const modalId = uuid4();
    modal.setCustomId(modalId);
    await interaction.showModal(modal);
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === modalId,
    });

    const rawBody = {
      registrationStartTime: modalSubmit.fields.getTextInputValue(
        "registrationStartTime"
      ),
      dailyAutocleanTime:
        modalSubmit.fields.getTextInputValue("dailyAutocleanTime"),
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
      guildConfig?.timezone || "UTC"
    );
    let autocleanTime = data.dailyAutocleanTime;
    if (autocleanTime) {
      autocleanTime = fromZonedTime(
        autocleanTime,
        guildConfig?.timezone || "UTC"
      );
      autocleanTime = dateFns.set(autocleanTime, {
        year: 1970,
        month: 0,
        date: 1,
      });
    }

    if (dateFns.isBefore(data.registrationStartTime, new Date())) {
      await modalSubmit.editReply({
        content: "Registration start time must be in the future.",
      });
      return;
    }
    scrim = await prisma.scrim.update({
      where: {
        id: scrimId,
      },
      data: {
        registrationStartTime: data.registrationStartTime,
        autocleanTime,
      },
    });
    await modalSubmit.editReply({
      content: "Scrim timing configuration updated successfully.",
    });
    await this.client.scrimService.scheduleRegistrationStart(scrim);
    await this.client.scrimService.scheduleAutoCleanup(scrim);
    await this.client.scrimService.updateScrimConfigMessage(scrim);
  }
}
