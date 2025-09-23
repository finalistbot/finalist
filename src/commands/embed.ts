import { Command } from "@/base/classes/command";
import { BracketError } from "@/base/classes/error";
import {
  ActionRowBuilder,
  APIEmbed,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Interaction,
  InteractionCollector,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

class EmbedBuilderHelper {
  embed = new EmbedBuilder()
    .setTitle("Sample Title")
    .setDescription("Description for embed builder");

  private collector: InteractionCollector<any> | null = null;
  private authorizedUserId: string;

  constructor(userId: string, initial: APIEmbed | null = null) {
    if (initial) {
      this.embed = EmbedBuilder.from(initial);
    }
    this.authorizedUserId = userId;
  }

  initialBuilderComponents(disabled: boolean = false) {
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("embed_builder_select")
        .setPlaceholder(
          disabled ? "This embed builder has expired" : "Select an option",
        )
        .setDisabled(disabled)
        .addOptions([
          {
            label: "Basic Details",
            description:
              "Change basic details like title, description and color",
            value: "basic_details",
          },
          {
            label: "Author",
            description: "Set author name, icon, and URL",
            value: "author",
          },
          {
            label: "Footer",
            description: "Change footer text and icon",
            value: "footer",
          },
          {
            label: "Images",
            description: "Add thumbnail and main image",
            value: "images",
          },
          {
            label: "Timestamp",
            description: "Add or remove timestamp",
            value: "timestamp",
          },
          {
            label: "Fields",
            description: "Add, edit, or remove fields",
            value: "fields",
          },
        ]),
    );
    return [row];
  }

  async handleSelectOption(message: Message) {
    if (this.collector) {
      this.collector.stop();
    }

    const messageRef = message;

    this.collector = message.createMessageComponentCollector({
      filter: (interaction) => {
        return (
          interaction.isStringSelectMenu() &&
          interaction.customId === "embed_builder_select" &&
          interaction.user.id === this.authorizedUserId
        );
      },
      time: 300000,
    });

    this.collector.on(
      "collect",
      async (interaction: StringSelectMenuInteraction) => {
        const value = interaction.values[0];
        switch (value) {
          case "basic_details":
            await this.showBasicDetailsModal(interaction);
            break;
          case "author":
            await this.showAuthorModal(interaction);
            break;
          case "footer":
            await this.showFooterModal(interaction);
            break;
          case "images":
            await this.showImagesModal(interaction);
            break;
          case "timestamp":
            await this.showTimestampModal(interaction);
            break;
          case "fields":
            await this.showFieldsModal(interaction);
            break;
        }
      },
    );

    this.collector.on("end", async () => {
      try {
        await messageRef.edit({
          embeds: [this.embed],
          components: this.initialBuilderComponents(true),
        });
        console.log("Embed builder collector ended - components disabled");
      } catch (error) {
        console.log("Failed to disable components on timeout:", error);
      }
    });

    // Handle unauthorized users trying to interact
    const unauthorizedCollector = message.createMessageComponentCollector({
      filter: (interaction) => {
        return (
          interaction.isStringSelectMenu() &&
          interaction.customId === "embed_builder_select" &&
          interaction.user.id !== this.authorizedUserId
        );
      },
      time: 300000, // 5 minutes timeout
    });

    unauthorizedCollector.on(
      "collect",
      async (interaction: StringSelectMenuInteraction) => {
        await interaction.reply({
          content:
            "❌ Only the user who created this embed builder can interact with it.",
          ephemeral: true,
        });
      },
    );

    unauthorizedCollector.on("end", () => {
      console.log("Unauthorized collector ended");
    });
  }

  async showBasicDetailsModal(interaction: StringSelectMenuInteraction) {
    const titleInput = new TextInputBuilder()
      .setLabel("Title")
      .setCustomId("title")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256);
    const descriptionInput = new TextInputBuilder()
      .setLabel("Description")
      .setCustomId("description")
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000);
    const colorInput = new TextInputBuilder()
      .setLabel("Color")
      .setCustomId("color")
      .setRequired(false)
      .setStyle(TextInputStyle.Short);

    if (this.embed.data.title) {
      titleInput.setValue(this.embed.data.title);
    }
    if (this.embed.data.description) {
      descriptionInput.setValue(this.embed.data.description);
    }

    const modal = new ModalBuilder()
      .setTitle("Edit Basic Details")
      .setCustomId("embed_basic_details")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          descriptionInput,
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      );

    await interaction.showModal(modal);

    // Handle modal submission
    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        time: 60000,
      });

      const title = modalInteraction.fields.getTextInputValue("title");
      const description =
        modalInteraction.fields.getTextInputValue("description");
      const color = modalInteraction.fields.getTextInputValue("color");

      if (color) {
        if (!color.match(/^#([0-9a-f]{3}){1,2}$/i)) {
          throw new BracketError("Invalid color format. Use hex format.");
        }
        this.embed.setColor(color as any);
      } else {
        this.embed.setColor(null);
      }

      this.embed.setTitle(title || null);
      this.embed.setDescription(description || null);
      await this.updateEmbedAfterModal(modalInteraction);
    } catch (error) {
      // Modal was closed or timed out - do nothing, user can try again
      console.log("Modal submission timed out or was cancelled");
    }
  }

  async showAuthorModal(interaction: StringSelectMenuInteraction) {
    const authorNameInput = new TextInputBuilder()
      .setLabel("Author Name")
      .setCustomId("author_name")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256);
    const authorIconInput = new TextInputBuilder()
      .setLabel("Author Icon URL")
      .setCustomId("author_icon")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048);
    const authorUrlInput = new TextInputBuilder()
      .setLabel("Author URL")
      .setCustomId("author_url")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048);

    if (this.embed.data.author?.name) {
      authorNameInput.setValue(this.embed.data.author.name);
    }
    if (this.embed.data.author?.icon_url) {
      authorIconInput.setValue(this.embed.data.author.icon_url);
    }
    if (this.embed.data.author?.url) {
      authorUrlInput.setValue(this.embed.data.author.url);
    }

    const modal = new ModalBuilder()
      .setTitle("Edit Author")
      .setCustomId("embed_author")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(authorNameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(authorIconInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(authorUrlInput),
      );

    await interaction.showModal(modal);

    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        time: 60000,
      });

      const authorName =
        modalInteraction.fields.getTextInputValue("author_name");
      const authorIcon =
        modalInteraction.fields.getTextInputValue("author_icon");
      const authorUrl = modalInteraction.fields.getTextInputValue("author_url");

      if (!authorName) {
        this.embed.setAuthor(null);
        await this.updateEmbedAfterModal(modalInteraction);
        return;
      }

      const authorOptions: any = { name: authorName };
      if (authorIcon) authorOptions.iconURL = authorIcon;
      if (authorUrl) authorOptions.url = authorUrl;

      this.embed.setAuthor(authorOptions);
      await this.updateEmbedAfterModal(modalInteraction);
    } catch (error) {
      console.log("Author modal submission timed out or was cancelled");
    }
  }

  async showImagesModal(interaction: StringSelectMenuInteraction) {
    const thumbnailInput = new TextInputBuilder()
      .setLabel("Thumbnail URL")
      .setCustomId("thumbnail")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048);
    const imageInput = new TextInputBuilder()
      .setLabel("Main Image URL")
      .setCustomId("image")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048);

    if (this.embed.data.thumbnail?.url) {
      thumbnailInput.setValue(this.embed.data.thumbnail.url);
    }
    if (this.embed.data.image?.url) {
      imageInput.setValue(this.embed.data.image.url);
    }

    const modal = new ModalBuilder()
      .setTitle("Edit Images")
      .setCustomId("embed_images")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
      );

    await interaction.showModal(modal);

    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        time: 60000,
      });

      const thumbnail = modalInteraction.fields.getTextInputValue("thumbnail");
      const image = modalInteraction.fields.getTextInputValue("image");

      if (thumbnail) {
        this.embed.setThumbnail(thumbnail);
      } else {
        this.embed.setThumbnail(null);
      }

      if (image) {
        this.embed.setImage(image);
      } else {
        this.embed.setImage(null);
      }

      await this.updateEmbedAfterModal(modalInteraction);
    } catch (error) {
      console.log("Images modal submission timed out or was cancelled");
    }
  }

  async showTimestampModal(interaction: StringSelectMenuInteraction) {
    const timestampInput = new TextInputBuilder()
      .setLabel("Timestamp")
      .setCustomId("timestamp")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(
        "Leave empty to use current time, or enter 'none' to remove",
      )
      .setMaxLength(50);

    if (this.embed.data.timestamp) {
      timestampInput.setValue(
        new Date(this.embed.data.timestamp).toISOString(),
      );
    }

    const modal = new ModalBuilder()
      .setTitle("Edit Timestamp")
      .setCustomId("embed_timestamp")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(timestampInput),
      );

    await interaction.showModal(modal);

    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        time: 60000,
      });

      const timestamp = modalInteraction.fields
        .getTextInputValue("timestamp")
        .trim();

      if (timestamp.toLowerCase() === "none") {
        this.embed.setTimestamp(null);
      } else if (timestamp === "") {
        this.embed.setTimestamp(new Date());
      } else {
        try {
          const date = new Date(timestamp);
          if (isNaN(date.getTime())) {
            throw new Error("Invalid date");
          }
          this.embed.setTimestamp(date);
        } catch (error) {
          this.embed.setTimestamp(new Date());
        }
      }

      await this.updateEmbedAfterModal(modalInteraction);
    } catch (error) {
      console.log("Timestamp modal submission timed out or was cancelled");
    }
  }

  async showFieldsModal(interaction: StringSelectMenuInteraction) {
    const fieldNameInput = new TextInputBuilder()
      .setLabel("Field Name")
      .setCustomId("field_name")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(256)
      .setPlaceholder(
        "Enter field name to add/edit, leave empty to clear all fields",
      );
    const fieldValueInput = new TextInputBuilder()
      .setLabel("Field Value")
      .setCustomId("field_value")
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1024);
    const fieldInlineInput = new TextInputBuilder()
      .setLabel("Inline")
      .setCustomId("field_inline")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("true/false (default: false)")
      .setMaxLength(5);

    const modal = new ModalBuilder()
      .setTitle("Add/Edit Field")
      .setCustomId("embed_fields")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(fieldNameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(fieldValueInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          fieldInlineInput,
        ),
      );

    await interaction.showModal(modal);

    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        time: 60000,
      });

      const fieldName = modalInteraction.fields
        .getTextInputValue("field_name")
        .trim();
      const fieldValue = modalInteraction.fields
        .getTextInputValue("field_value")
        .trim();
      const fieldInline = modalInteraction.fields
        .getTextInputValue("field_inline")
        .trim()
        .toLowerCase();

      if (!fieldName && !fieldValue) {
        // Clear all fields
        this.embed.setFields([]);
      } else if (fieldName && fieldValue) {
        // Add new field
        const inline = fieldInline === "true";
        this.embed.addFields({ name: fieldName, value: fieldValue, inline });
      }

      await this.updateEmbedAfterModal(modalInteraction);
    } catch (error) {
      console.log("Fields modal submission timed out or was cancelled");
    }
  }

  async showFooterModal(interaction: StringSelectMenuInteraction) {
    const footerTextInput = new TextInputBuilder()
      .setLabel("Footer Text")
      .setCustomId("footer_text")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048);
    const footerIconInput = new TextInputBuilder()
      .setLabel("Footer Icon URL")
      .setCustomId("footer_icon")
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2048);

    if (this.embed.data.footer?.text) {
      footerTextInput.setValue(this.embed.data.footer.text);
    }
    if (this.embed.data.footer?.icon_url) {
      footerIconInput.setValue(this.embed.data.footer.icon_url);
    }

    const modal = new ModalBuilder()
      .setTitle("Edit Footer")
      .setCustomId("embed_footer")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(footerTextInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(footerIconInput),
      );

    await interaction.showModal(modal);

    // Handle modal submission
    try {
      const modalInteraction = await interaction.awaitModalSubmit({
        time: 60000,
      });

      const footerText =
        modalInteraction.fields.getTextInputValue("footer_text");
      const footerIcon =
        modalInteraction.fields.getTextInputValue("footer_icon");

      if (!footerText) {
        this.embed.setFooter(null);
        await this.updateEmbedAfterModal(modalInteraction);
        return;
      }

      if (!footerIcon) {
        this.embed.setFooter({
          text: footerText,
        });
      } else {
        this.embed.setFooter({
          text: footerText,
          iconURL: footerIcon,
        });
      }
      await this.updateEmbedAfterModal(modalInteraction);
    } catch (error) {
      // Modal was closed or timed out - do nothing, user can try again
      console.log("Modal submission timed out or was cancelled");
    }
  }

  async updateEmbed(interaction: Interaction) {
    if (!interaction.isRepliable()) return;
    if (interaction.isModalSubmit()) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply();
    }
    const message = await interaction.editReply({
      embeds: [this.embed],
      components: this.initialBuilderComponents(),
    });
    await this.handleSelectOption(message);
  }

  async updateEmbedAfterModal(interaction: ModalSubmitInteraction) {
    if (!interaction.isRepliable()) return;
    await interaction.deferUpdate();
    await interaction.editReply({
      embeds: [this.embed],
      components: this.initialBuilderComponents(),
    });
  }
}

export default class EmbedBuilderCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Sends an embed message");
  async execute(interaction: ChatInputCommandInteraction) {
    const builder = new EmbedBuilderHelper(interaction.user.id);
    await builder.updateEmbed(interaction);
  }
}
