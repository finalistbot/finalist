import { IdentityInteraction } from "@/base/classes/identity-interaction";
import { BracketError } from "@/base/classes/error";
import { prisma } from "@/lib/prisma";
import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { parseIdFromString } from "@/lib/utils";
import * as dateFns from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export class ShowTournamentTimingConfigModal extends IdentityInteraction<"button"> {
  type = "button" as const;
  id = "show_tournament_timing_config_modal";

  async execute(interaction: ButtonInteraction) {
    const tournamentId = parseIdFromString(interaction.customId);
    if (!tournamentId) {
      await interaction.reply({
        content: "Invalid tournament ID.",
        ephemeral: true,
      });
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      await interaction.reply({
        content: "Tournament not found.",
        ephemeral: true,
      });
      return;
    }

    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: tournament.guildId },
    });

    const timezone = guildConfig?.timezone || "UTC";
    const regStartTime = toZonedTime(
      tournament.registrationStartTime,
      timezone
    );
    const tournamentStartTime = tournament.tournamentStartTime
      ? toZonedTime(tournament.tournamentStartTime, timezone)
      : null;

    const modal = new ModalBuilder()
      .setCustomId(`tournament_timing_config_modal:${tournamentId}`)
      .setTitle("Configure Tournament Timings");

    const regDateInput = new TextInputBuilder()
      .setCustomId("reg_date")
      .setLabel("Registration Start Date (YYYY-MM-DD)")
      .setStyle(TextInputStyle.Short)
      .setValue(dateFns.format(regStartTime, "yyyy-MM-dd"))
      .setRequired(true)
      .setPlaceholder("2024-12-25");

    const regTimeInput = new TextInputBuilder()
      .setCustomId("reg_time")
      .setLabel("Registration Start Time (HH:MM)")
      .setStyle(TextInputStyle.Short)
      .setValue(dateFns.format(regStartTime, "HH:mm"))
      .setRequired(true)
      .setPlaceholder("14:30");

    const tournamentDateInput = new TextInputBuilder()
      .setCustomId("tournament_date")
      .setLabel("Tournament Start Date (YYYY-MM-DD, optional)")
      .setStyle(TextInputStyle.Short)
      .setValue(
        tournamentStartTime
          ? dateFns.format(tournamentStartTime, "yyyy-MM-dd")
          : ""
      )
      .setRequired(false)
      .setPlaceholder("2024-12-26");

    const tournamentTimeInput = new TextInputBuilder()
      .setCustomId("tournament_time")
      .setLabel("Tournament Start Time (HH:MM, optional)")
      .setStyle(TextInputStyle.Short)
      .setValue(
        tournamentStartTime ? dateFns.format(tournamentStartTime, "HH:mm") : ""
      )
      .setRequired(false)
      .setPlaceholder("16:00");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(regDateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(regTimeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        tournamentDateInput
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        tournamentTimeInput
      )
    );

    await interaction.showModal(modal);
  }
}

export class TournamentTimingConfigModalSubmit extends IdentityInteraction<"modal"> {
  type = "modal" as const;
  id = "tournament_timing_config_modal";

  async execute(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const tournamentId = parseIdFromString(interaction.customId);
    if (!tournamentId) {
      await interaction.editReply({ content: "Invalid tournament ID." });
      return;
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      await interaction.editReply({ content: "Tournament not found." });
      return;
    }

    if (tournament.stage !== "SETUP") {
      await interaction.editReply({
        content: "Cannot modify timings after registration has started.",
      });
      return;
    }

    const guildConfig = await prisma.guildConfig.findUnique({
      where: { id: tournament.guildId },
    });

    const timezone = guildConfig?.timezone || "UTC";

    const regDate = interaction.fields.getTextInputValue("reg_date");
    const regTime = interaction.fields.getTextInputValue("reg_time");
    const tournamentDate =
      interaction.fields.getTextInputValue("tournament_date");
    const tournamentTime =
      interaction.fields.getTextInputValue("tournament_time");

    try {
      // Parse registration time
      const regParts = regDate.split("-").map(Number);
      const regTimeParts = regTime.split(":").map(Number);

      if (regParts.length !== 3 || regTimeParts.length !== 2) {
        throw new Error("Invalid date/time format");
      }

      const [regYear, regMonth, regDay] = regParts;
      const [regHour, regMinute] = regTimeParts;

      if (
        !regYear ||
        !regMonth ||
        !regDay ||
        regHour === undefined ||
        regMinute === undefined
      ) {
        throw new Error("Invalid date/time values");
      }

      const regStartTimeZoned = new Date(
        regYear,
        regMonth - 1,
        regDay,
        regHour,
        regMinute
      );
      const registrationStartTime = fromZonedTime(regStartTimeZoned, timezone);

      let tournamentStartTime: Date | null = null;
      if (tournamentDate && tournamentTime) {
        const tParts = tournamentDate.split("-").map(Number);
        const tTimeParts = tournamentTime.split(":").map(Number);

        if (tParts.length !== 3 || tTimeParts.length !== 2) {
          throw new Error("Invalid tournament date/time format");
        }

        const [tYear, tMonth, tDay] = tParts;
        const [tHour, tMinute] = tTimeParts;

        if (
          !tYear ||
          !tMonth ||
          !tDay ||
          tHour === undefined ||
          tMinute === undefined
        ) {
          throw new Error("Invalid tournament date/time values");
        }

        const tournamentStartTimeZoned = new Date(
          tYear,
          tMonth - 1,
          tDay,
          tHour,
          tMinute
        );
        tournamentStartTime = fromZonedTime(tournamentStartTimeZoned, timezone);
      }

      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          registrationStartTime,
          tournamentStartTime,
        },
      });

      await this.client.tournamentService.updateTournamentConfigMessage(
        tournament
      );
      await this.client.tournamentService.scheduleRegistrationStart(tournament);

      await interaction.editReply({
        content: "Tournament timings updated successfully!",
      });
    } catch (error) {
      if (error instanceof BracketError) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.editReply({
          content:
            "Invalid date/time format. Please use YYYY-MM-DD for dates and HH:MM for times.",
        });
      }
    }
  }
}

export default ShowTournamentTimingConfigModal;
