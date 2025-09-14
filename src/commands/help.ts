import { Command, CommandRegistory } from "@/base/classes/command";
import { BRAND_COLOR } from "@/lib/constants";
import { convertToTitleCase } from "@/lib/utils";
import { CommandCategory, CommandInfo } from "@/types/command";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
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
        .setRequired(false),
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
          content: `Invalid command format. Use "command subcommand".`,
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

    // If nothing found
    await interaction.reply({
      content: `Command or category "${query}" not found.`,
      ephemeral: true,
    });
  }

  async sendBotHelp(interaction: ChatInputCommandInteraction) {
    const commandByCategory = CommandRegistory.getAllCommands().reduce(
      (acc, command) => {
        const category = command.info?.category || "General";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(command);
        return acc;
      },
      {} as Record<string, Command[]>,
    );

    const embed = new EmbedBuilder()
      .setTitle("Commands")
      .setDescription("Use `/help <command>` for more details")
      .setColor(BRAND_COLOR)
      .setTimestamp();

    for (const [categoryName, commands] of Object.entries(commandByCategory)) {
      const filteredCommands = commands.filter((cmd) => cmd.info !== undefined);
      const category = CommandRegistory.getCategory(categoryName);
      const emoji = category?.emoji || "";

      const commandList = filteredCommands
        .map((cmd) => `\`${cmd.info!.name}\``)
        .join("  ");

      if (commandList) {
        embed.addFields({
          name: `${emoji} ${categoryName}`,
          value: commandList,
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  }

  async sendCommandHelp(
    interaction: ChatInputCommandInteraction,
    command: Command,
  ) {
    if (!command.info) {
      return interaction.reply({
        content: "No help available for this command.",
        ephemeral: true,
      });
    }

    const info = command.info;
    const embed = new EmbedBuilder()
      .setTitle(`/${info.name}`)
      .setDescription(info.description)
      .setColor(BRAND_COLOR)
      .setTimestamp();

    if (info.longDescription) {
      embed.setDescription(`${info.longDescription || info.description}`);
    }

    if (info.usageExamples && info.usageExamples.length > 0) {
      embed.addFields({
        name: "Examples",
        value: info.usageExamples.map((example) => `\`${example}\``).join("\n"),
        inline: false,
      });
    }

    if (info.options && info.options.length > 0) {
      const options = info.options
        .map((option) => {
          const req = option.required ? " *" : "";
          return `**${option.name}**${req} - ${option.description}`;
        })
        .join("\n");

      embed.addFields({
        name: "Parameters",
        value: options,
        inline: false,
      });
    }

    if (info.subcommands && info.subcommands.length > 0) {
      const subcommands = info.subcommands
        .map(
          (sub) => `**${sub.name}** - ${sub.description || "No description"}`,
        )
        .join("\n");

      embed.addFields({
        name: "Subcommands",
        value: subcommands,
        inline: false,
      });
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
        content: "No help available for this subcommand.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`/${command.info.name} ${subcommand.name}`)
      .setDescription(subcommand.description || "No description available")
      .setColor(BRAND_COLOR)
      .setTimestamp();

    if (subcommand.longDescription) {
      embed.setDescription(
        `${subcommand.description}\n\n${subcommand.longDescription}`,
      );
    }

    if (subcommand.usageExamples && subcommand.usageExamples.length > 0) {
      embed.addFields({
        name: "Examples",
        value: subcommand.usageExamples
          .map((example: string) => `\`${example}\``)
          .join("\n"),
        inline: false,
      });
    }

    if (subcommand.options && subcommand.options.length > 0) {
      const options = subcommand.options
        .map((option: any) => {
          const req = option.required ? " *" : "";
          return `**${option.name}**${req} - ${option.description}`;
        })
        .join("\n");

      embed.addFields({
        name: "Parameters",
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
    const commands = CommandRegistory.getCommandsByCategory(category.name);
    const emoji = category.emoji || "";

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${category.name}`)
      .setColor(BRAND_COLOR)
      .setTimestamp();

    for (const command of commands) {
      if (!command.info) continue;

      let description = command.info.description || "No description available";

      if (command.info.subcommands && command.info.subcommands.length > 0) {
        const subList = command.info.subcommands
          .map((sub) => sub.name)
          .join(", ");
        description += `\n*Subcommands: ${subList}*`;
      }

      embed.addFields({
        name: `/${command.info.name}`,
        value: description,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
}
