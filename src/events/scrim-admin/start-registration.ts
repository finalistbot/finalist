import { BracketError, CheckFailure } from "@/base/classes/error";
import { Event } from "@/base/classes/event";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { parseIdFromString, safeRunChecks } from "@/lib/utils";
import { prepareRegisterTeamComponents } from "@/ui/components/global-team-components";
import { registerEmbed } from "@/ui/embeds/register";
import { Stage } from "@prisma/client";
import { CacheType, Interaction, TextChannel } from "discord.js";

export default class StartRegistrationButtonHandler extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  async execute(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("start_registration:")) return;
    const scrimId = parseIdFromString(interaction.customId);
    if (!scrimId) {
      await interaction.reply({
        content: "Invalid scrim ID.",
      });
      return;
    }
    await interaction.deferReply({ flags: "Ephemeral" });
    const checkResult = await safeRunChecks(interaction, isScrimAdmin);
    if (!checkResult.success) {
      await interaction.editReply({
        content: checkResult.reason,
      });
      return;
    }

    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} does not exist.`,
      });
      return;
    }

    if (scrim.stage != Stage.CONFIGURATION) {
      await interaction.editReply({
        content: `Scrim with ID ${scrimId} is not in the configuration stage.`,
      });
      return;
    }
    try {
      await this.client.scrimService.openRegistration(scrim);
    } catch (e) {
      if (e instanceof BracketError) {
        await interaction.editReply({
          content: e.message,
        });
        return;
      }
    }
    const embed = registerEmbed();
    const components = prepareRegisterTeamComponents();
    const channel = (await this.client.channels.fetch(
      scrim.registrationChannelId
    )) as TextChannel;

    await channel!.send({ embeds: [embed], components: components });
  }
}
