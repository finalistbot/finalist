import { Command, CommandRegistory } from "@/base/classes/command";
import { BRAND_COLOR } from "@/lib/constants";
import { convertToTitleCase } from "@/lib/utils";
import { CommandCategory, CommandInfo } from "@/types/command";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Interaction,
  AutocompleteInteraction,
} from "discord.js";

export default class HelpCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get a list of available commands.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription(
          "Get help for a specific command, subcommand, or category.",
        )
        .setRequired(false)
        .setAutocomplete(true),
    );
  info: CommandInfo = {
    name: "help",
    category: "General",
    description: "Get a list of available commands.",
    usageExamples: [
      "/help",
      "/help name:ping",
      "/help name:General",
      "/help name:team create",
    ],
    options: [
      {
        name: "name",
        description:
          "Get help for a specific command, subcommand, or category.",
        type: "STRING",
        required: false,
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString("name");
    if (!query) {
      return await this.sendBotHelp(interaction);
    }

    // Check for subcommand format (e.g., "team create")
    if (query.includes(" ")) {
      const [commandName, subcommandName] = query.split(" ", 2);
      if (!commandName || !subcommandName) {
        return await interaction.reply({
          content: `❌ Invalid format. Use: \`/help name:command subcommand\`\nExample: \`/help name:team create\``,
          ephemeral: true,
        });
      }
      const command = CommandRegistory.getCommand(commandName.toLowerCase());
      if (command && command.info?.subcommands) {
        const subcommand = command.info.subcommands.find(
          (sub) => sub.name.toLowerCase() === subcommandName.toLowerCase(),
        );
        if (subcommand) {
          return await this.sendSubcommandHelp(
            interaction,
            command,
            subcommand,
          );
        }
      }
    }

    // Check for regular command
    const command = CommandRegistory.getCommand(query.toLowerCase());
    if (command) {
      return await this.sendCommandHelp(interaction, command);
    }

    // Check for category
    const category = CommandRegistory.getCategory(convertToTitleCase(query));
    if (category) {
      return await this.sendCategoryHelp(interaction, category);
    }

    // If nothing found - provide helpful suggestions
    const allCommands = CommandRegistory.getAllCommands()
      .filter((cmd) => cmd.info)
      .map((cmd) => cmd.info!.name);
    const categories = Array.from(
      new Set(
        CommandRegistory.getAllCommands()
          .map((cmd) => cmd.info?.category)
          .filter(Boolean),
      ),
    );

    await interaction.reply({
      content:
        `❌ **"${query}" not found**\n\n` +
        `💡 **Try:**\n` +
        `• \`/help\` - See all commands\n` +
        `• \`/help name:${allCommands[0]}\` - View a command\n` +
        `• \`/help name:${categories[0]}\` - Browse a category`,
      ephemeral: true,
    });
  }

  async sendBotHelp(interaction: ChatInputCommandInteraction) {
    const allCommands = CommandRegistory.getAllCommands()
      .filter((cmd) => cmd.info)
      .sort((a, b) => a.info!.name.localeCompare(b.info!.name));

    const COMMANDS_PER_PAGE = 8;
    const totalPages = Math.ceil(allCommands.length / COMMANDS_PER_PAGE);
    let currentPage = 0;

    const generateEmbed = (page: number) => {
      const start = page * COMMANDS_PER_PAGE;
      const end = start + COMMANDS_PER_PAGE;
      const pageCommands = allCommands.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle("📚 Command Help")
        .setDescription(
          `Showing **${allCommands.length}** available commands\n\n` +
            `💡 Use \`/help name:command\` for detailed information`,
        )
        .setColor(BRAND_COLOR)
        .setFooter({
          text: `Page ${page + 1} of ${totalPages} • Use buttons to navigate`,
        })
        .setTimestamp();

      for (const command of pageCommands) {
        const info = command.info!;

        let description = info.description || "No description available";

        embed.addFields({
          name: `/${info.name}`,
          value: description,
          inline: false,
        });
      }

      return embed;
    };

    const generateButtons = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("first")
          .setLabel("⏮️ First")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("page_indicator")
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1),
        new ButtonBuilder()
          .setCustomId("last")
          .setLabel("Last ⏭️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1),
      );
      return row;
    };

    const interactionResponse = await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: totalPages > 1 ? [generateButtons(currentPage)] : [],
      withResponse: true,
    });
    const message = interactionResponse.resource?.message!;

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content:
            "❌ These buttons aren't for you! Use `/help` to get your own help menu.",
          ephemeral: true,
        });
        return;
      }

      switch (buttonInteraction.customId) {
        case "first":
          currentPage = 0;
          break;
        case "prev":
          currentPage = Math.max(0, currentPage - 1);
          break;
        case "next":
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          break;
        case "last":
          currentPage = totalPages - 1;
          break;
      }

      await buttonInteraction.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)],
      });
    });

    collector.on("end", async () => {
      try {
        // Disable all buttons instead of removing them
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("first")
            .setLabel("⏮️ First")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("◀️ Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("page_indicator")
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next ▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("last")
            .setLabel("Last ⏭️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );

        const currentEmbed = EmbedBuilder.from(message.embeds[0]!).setFooter({
          text: `Page ${currentPage + 1} of ${totalPages} • Buttons timed out`,
        });

        await message.edit({
          embeds: [currentEmbed],
          components: [disabledRow],
        });
      } catch (error) {
        // Message was likely deleted
      }
    });
  }

  async sendCommandHelp(
    interaction: ChatInputCommandInteraction,
    command: Command,
  ) {
    if (!command.info) {
      return interaction.reply({
        content: "❌ No help available for this command.",
        ephemeral: true,
      });
    }

    const info = command.info;
    const categoryEmoji =
      (info.category
        ? CommandRegistory.getCategory(info.category)?.emoji
        : null) || "📁";

    const embed = new EmbedBuilder()
      .setTitle(`\`/${info.name}\``)
      .setColor(BRAND_COLOR)
      .setTimestamp();

    // Description section
    let description = `**${info.longDescription || info.description}**\n\n`;
    description += `${categoryEmoji} **Category:** ${info.category}`;

    embed.setDescription(description);

    // Usage section with examples
    if (info.usageExamples && info.usageExamples.length > 0) {
      const exampleText = info.usageExamples
        .map((example, index) => `${index + 1}. \`${example}\``)
        .join("\n");

      embed.addFields({
        name: "📝 Usage Examples",
        value: exampleText,
        inline: false,
      });
    }

    // Parameters section
    if (info.options && info.options.length > 0) {
      const options = info.options
        .map((option) => {
          const required = option.required ? "**[Required]**" : "[Optional]";
          return `• **\`${option.name}\`** ${required}\n  ${option.description}`;
        })
        .join("\n\n");

      embed.addFields({
        name: "⚙️ Parameters",
        value: options,
        inline: false,
      });
    }

    // Subcommands section with pagination if needed
    if (info.subcommands && info.subcommands.length > 0) {
      if (info.subcommands.length <= 10) {
        const subcommands = info.subcommands
          .map((sub) => {
            const desc = sub.description || "No description";
            return `• **\`${sub.name}\`** - ${desc}`;
          })
          .join("\n");

        embed.addFields({
          name: `⚡ Subcommands (${info.subcommands.length})`,
          value: subcommands,
          inline: false,
        });
      } else {
        // Just list names if too many
        const subcommands = info.subcommands
          .map((sub) => `\`${sub.name}\``)
          .join(" • ");

        embed.addFields({
          name: `⚡ Subcommands (${info.subcommands.length})`,
          value:
            subcommands +
            `\n\n💡 Use \`/help name:${info.name} <subcommand>\` for details`,
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  }

  async sendSubcommandHelp(
    interaction: ChatInputCommandInteraction,
    command: Command,
    subcommand: any,
  ) {
    if (!command.info) {
      return interaction.reply({
        content: "❌ No help available for this subcommand.",
        ephemeral: true,
      });
    }

    const info = command.info;

    const categoryEmoji =
      (info.category
        ? CommandRegistory.getCategory(info.category)?.emoji
        : null) || "📁";

    const embed = new EmbedBuilder()
      .setTitle(`\`/${command.info.name} ${subcommand.name}\``)
      .setColor(BRAND_COLOR)
      .setTimestamp();

    // Description
    let description = `**${subcommand.longDescription || subcommand.description || "No description available"}**\n\n`;
    description += `${categoryEmoji} **Parent Command:** \`/${command.info.name}\``;

    embed.setDescription(description);

    // Usage examples
    if (subcommand.usageExamples && subcommand.usageExamples.length > 0) {
      const exampleText = subcommand.usageExamples
        .map((example: string, index: number) => `${index + 1}. \`${example}\``)
        .join("\n");

      embed.addFields({
        name: "📝 Usage Examples",
        value: exampleText,
        inline: false,
      });
    }

    // Parameters
    if (subcommand.options && subcommand.options.length > 0) {
      const options = subcommand.options
        .map((option: any) => {
          const required = option.required ? "**[Required]**" : "[Optional]";
          return `• **\`${option.name}\`** ${required}\n  ${option.description}`;
        })
        .join("\n\n");

      embed.addFields({
        name: "⚙️ Parameters",
        value: options,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  }

  async sendCategoryHelp(
    interaction: ChatInputCommandInteraction,
    category: CommandCategory,
  ) {
    const commands = CommandRegistory.getCommandsByCategory(category.name)
      .filter((cmd) => cmd.info)
      .sort((a, b) => a.info!.name.localeCompare(b.info!.name));

    const emoji = category.emoji || "📁";
    const COMMANDS_PER_PAGE = 8;
    const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
    let currentPage = 0;

    const generateEmbed = (page: number) => {
      const start = page * COMMANDS_PER_PAGE;
      const end = start + COMMANDS_PER_PAGE;
      const pageCommands = commands.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${category.name} Commands`)
        .setDescription(
          `**${commands.length}** commands in this category\n\n` +
            `💡 Use \`/help name:command\` for detailed information`,
        )
        .setColor(BRAND_COLOR)
        .setFooter({
          text: `Page ${page + 1} of ${totalPages}`,
        })
        .setTimestamp();

      for (const command of pageCommands) {
        if (!command.info) continue;

        let description =
          command.info.description || "No description available";

        // Add subcommands info if they exist
        if (command.info.subcommands && command.info.subcommands.length > 0) {
          description += `\n⚡ ${command.info.subcommands.length} subcommand${command.info.subcommands.length > 1 ? "s" : ""}`;
        }

        // Add usage example if available
        if (
          command.info.usageExamples &&
          command.info.usageExamples.length > 0
        ) {
          description += `\n📝 \`${command.info.usageExamples[0]}\``;
        }

        embed.addFields({
          name: `/${command.info.name}`,
          value: description,
          inline: false,
        });
      }

      return embed;
    };

    const generateButtons = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("cat_first")
          .setLabel("⏮️ First")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("cat_prev")
          .setLabel("◀️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("cat_page")
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("cat_next")
          .setLabel("Next ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1),
        new ButtonBuilder()
          .setCustomId("cat_last")
          .setLabel("Last ⏭️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1),
      );
      return row;
    };

    const interactionResponse = await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: totalPages > 1 ? [generateButtons(currentPage)] : [],
      withResponse: true,
    });
    const message = interactionResponse.resource?.message!;

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "❌ These buttons aren't for you!",
          ephemeral: true,
        });
        return;
      }

      switch (buttonInteraction.customId) {
        case "cat_first":
          currentPage = 0;
          break;
        case "cat_prev":
          currentPage = Math.max(0, currentPage - 1);
          break;
        case "cat_next":
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          break;
        case "cat_last":
          currentPage = totalPages - 1;
          break;
      }

      await buttonInteraction.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)],
      });
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch (error) {}
    });
  }
  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.inGuild()) return;
    const focused = interaction.options.getFocused().toLowerCase();
    const allCommands = CommandRegistory.getAllCommands()
      .filter((cmd) => cmd.info && cmd.info.name)
      .map((cmd) => cmd.info!.name as string);
    const categories = Array.from(
      new Set(
        CommandRegistory.getAllCommands()
          .map((cmd) => cmd.info?.category)
          .filter((cat): cat is string => Boolean(cat)),
      ),
    );
    const allOptions = [...allCommands, ...categories];
    const filtered = allOptions
      .filter(
        (option): option is string =>
          typeof option === "string" && option.toLowerCase().includes(focused),
      )
      .slice(0, 25)
      .map((option) => ({
        name: option,
        value: option,
      }));

    await interaction.respond(filtered);
  }
}
