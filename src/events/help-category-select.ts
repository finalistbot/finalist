import {
  ActionRow,
  ActionRowBuilder,
  EmbedBuilder,
  Interaction,
  StringSelectMenuComponent,
} from "discord.js";
import { Event } from "@/base/classes/event";
import { BRAND_COLOR } from "@/lib/constants";

const adminCommands = [
  { name: "setup", description: "Setup the bot for your server." },
  { name: "create", description: "Create a new Scrim." },
  { name: "ban", description: "Ban a user from the server." },
  { name: "unban", description: "Unban a user from the server." },
  { name: "delete", description: "Delete an existing Scrim." },
  { name: "slotlist", description: "View the list of available slots." },
  { name: "rd-set", description: "Set the game details in the Scrim." },
  { name: "rd-clear", description: "Clear the game details in the Scrim." },
  { name: "rd-post", description: "Post the game details in the Scrim." },
];

const teamCommands = [
  { name: "team create", description: "Create a new team." },
  { name: "team info", description: "View information about your team." },
  { name: "team leave", description: "Leave your current team." },
  { name: "team join", description: "Join an existing team." },
  { name: "team disband", description: "Disband your current team." },
  { name: "team kick", description: "Kick a user from your team." },
  { name: "register", description: "Register your team for scrims." },
];

const scrimCommands = [
  { name: "invite", description: "Get the bot's invite link." },
  { name: "ping", description: "Check the bot's latency." },
  { name: "help", description: "Get a list of available commands." },
];

export default class HelpCategorySelectEvent extends Event<"interactionCreate"> {
  public event = "interactionCreate" as const;

  public async execute(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "help_category_select") return;

    const selected = interaction.values[0];
    let commandsList: { name: string; description: string }[] = [];

    switch (selected) {
      case "admin":
        commandsList = adminCommands;
        break;
      case "team":
        commandsList = teamCommands;
        break;
      case "scrim":
        commandsList = scrimCommands;
        break;
    }
    const component = interaction.message.components[0]!
      .components[0]! as StringSelectMenuComponent;

    const newOptions = component.options.map((opt) => ({
      ...opt,
      default: opt.value === selected,
    }));

    const newComponent = {
      ...component,
      options: newOptions,
    };

    const commandsFormatted = commandsList
      .map((cmd) => `\`${cmd.name}\` • _${cmd.description}_`)
      .join("\n\n");

    const categoryEmbed = new EmbedBuilder()
      .setTitle(
        `${selected!.charAt(0).toUpperCase() + selected!.slice(1)} Commands`
      )
      .setDescription(commandsFormatted || "No commands found.")
      .setColor(BRAND_COLOR);

    await interaction.update({
      embeds: [categoryEmbed],
      components: [
        new ActionRowBuilder<any>().addComponents(newComponent as any),
      ],
    });
  }
}
