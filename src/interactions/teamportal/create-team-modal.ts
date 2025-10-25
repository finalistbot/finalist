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

const TeamConfigSchema = z.object({
  teamName: z.string().min(2).max(32),
  ign: z.string().min(3).max(100),
  tag: z.string().max(10).optional(),
});

function createTeamModal() {
  return new ModalBuilder()
    .setTitle("Create Your Team")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Team Name")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("team_name")
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(100)
            .setPlaceholder("Enter your global team name")
            .setRequired(true)
        ),
      new LabelBuilder()
        .setLabel("In-Game Name")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("team_ign")
            .setStyle(TextInputStyle.Short)
            .setMinLength(3)
            .setMaxLength(100)
            .setPlaceholder("Enter your in-game name")
            .setRequired(true)
        ),
      new LabelBuilder()
        .setLabel("Tag Name")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("team_tag")
            .setStyle(1)
            .setMinLength(1)
            .setMaxLength(50)
            .setPlaceholder("Set your team tag")
            .setRequired(false)
        )
    );
}

export default class ShowTeamModal extends IdentityInteraction<"button"> {
  id = "show_create_team_modal";
  type = "button" as const;
  async execute(interaction: ButtonInteraction) {
    const modal = createTeamModal();
    const modalId = uuid4();
    modal.setCustomId(modalId);
    await interaction.showModal(modal);
    const modalSubmit = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.customId === modalId && i.user.id === interaction.user.id,
    });
    const rawBody = {
      teamName: modalSubmit.fields.getTextInputValue("team_name"),
      ign: modalSubmit.fields.getTextInputValue("team_ign"),
      tag: modalSubmit.fields.getTextInputValue("team_tag"),
    };
    const parsed = TeamConfigSchema.safeParse(rawBody);
    if (!parsed.success) {
      await interaction.editReply({
        content: `There was an error with your input: ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      });
      return;
    }
    const normalized = {
      ...parsed.data,
      tag: parsed.data.tag ?? "",
    };
    let team;
    try {
      team = await this.client.teamManageService.createTeam(
        interaction.user,
        interaction.guildId!,
        normalized
      );
    } catch (e) {
      if (e instanceof BracketError) {
        await interaction.editReply({
          content: e.message,
          embeds: [],
          components: [],
        });
        return;
      }
      throw e;
    }
    await interaction.editReply({
      content: `Team **${team.name}** created successfully! Your team code is: \`${team.code}\`. Share this code with your teammates to join your team.`,
    });
  }
}
