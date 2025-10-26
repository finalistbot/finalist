import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { v4 as uuid4 } from "uuid";
import z from "zod";

import { BracketError } from "@/base/classes/error";
import { IdentityInteraction } from "@/base/classes/identity-interaction";

const JoinTeamSchema = z.object({
  code: z.string().length(8),
  ign: z.string().min(3).max(100),
  substitute: z.string().transform((val) => val === "true"),
});
function joinTeamModal() {
  return new ModalBuilder().setTitle("Join a Team").addLabelComponents(
    new LabelBuilder()
      .setLabel("Team Code")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("join_team_code")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(8)
          .setPlaceholder("Enter the 8 character team code")
          .setRequired(true)
      ),
    new LabelBuilder()
      .setLabel("In-Game Name")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("join_team_ign")
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(100)
          .setPlaceholder("Enter your in-game name")
          .setRequired(true)
      ),
    new LabelBuilder()
      .setLabel("Substitute")
      .setDescription("Are you joining as a substitute?")

      .setStringSelectMenuComponent((builder) =>
        builder
          .setCustomId("join_team_substitute")

          .addOptions(
            {
              label: "Yes",
              description: "Join as a substitute",
              value: "true",
            },
            {
              label: "No",
              description: "Join as a regular member",
              value: "false",
              default: true,
            }
          )
      )
  );
}
export default class JoinTeamModel extends IdentityInteraction<"button"> {
  id = "show_join_team_modal";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;
    const modal = joinTeamModal();
    const modalId = uuid4();
    modal.setCustomId(modalId);
    await interaction.showModal(modal);

    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.customId === modalId && i.user.id === interaction.user.id,
    });

    const rawBody = {
      code: modalSubmit.fields.getTextInputValue("join_team_code"),
      ign: modalSubmit.fields.getTextInputValue("join_team_ign"),
      substitute: modalSubmit.fields.getStringSelectValues(
        "join_team_substitute"
      )[0],
    };
    await modalSubmit.deferReply({ flags: ["Ephemeral"] });
    const parsed = JoinTeamSchema.safeParse(rawBody);
    if (!parsed.success) {
      await modalSubmit.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }

    const normalized = {
      teamCode: parsed.data.code,
      ign: parsed.data.ign,
      substitute: parsed.data.substitute ?? false,
    };
    let team;
    try {
      team = await this.client.teamManageService.joinTeam(
        interaction.user,
        interaction.guildId,
        normalized
      );
    } catch (e) {
      if (e instanceof BracketError) {
        await modalSubmit.editReply({
          content: e.message,
          embeds: [],
          components: [],
        });
        return;
      }
      throw e;
    }
    await modalSubmit.editReply({
      content: `You have successfully joined the team **${team.name}**!`,
    });
  }
}
