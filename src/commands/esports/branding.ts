import { Command } from "@/base/classes/command";
import { isScrimAdmin } from "@/checks/scrim-admin";
import { prisma } from "@/lib/prisma";
import { suppress } from "@/lib/utils";
import { CommandInfo } from "@/types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default class BrandingCommand extends Command {
  data = new SlashCommandBuilder()
    .setName("branding")
    .setDescription("set branding for your scrim")
    .addAttachmentOption((option) =>
      option
        .setName("file")
        .setDescription("Upload your branding logo")
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName("banner")
        .setDescription("Upload your branding banner")
        .setRequired(false)
    );
  info?: CommandInfo = {
    name: "branding",
    description: "Set branding for your scrim.",
    longDescription:
      "Allows admins to set custom branding for their scrims, including logos and banners.",
    usageExamples: [
      "/branding file:<upload your logo> banner:<upload your banner>",
    ],
    category: "Esports",
    options: [
      {
        name: "file",
        description: "Upload your branding logo",
        type: "ATTACHMENT",
        required: false,
      },
      {
        name: "banner",
        description: "Upload your branding banner",
        type: "ATTACHMENT",
        required: false,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const isAdmin = await suppress(isScrimAdmin(interaction), false);

    if (!isAdmin) {
      await interaction.reply({
        content: "You do not have permission to use this command.",
        flags: ["Ephemeral"],
      });
      return;
    }
    const logo = interaction.options.getAttachment("file");
    const banner = interaction.options.getAttachment("banner");

    await prisma.guildConfig.update({
      where: { id: interaction.guildId },
      data: {
        logoUrl: logo?.url || null,
        bannerUrl: banner?.url || null,
      },
    });
    await interaction.reply({
      content: "Branding updated successfully!",
      flags: ["Ephemeral"],
    });
  }
}
