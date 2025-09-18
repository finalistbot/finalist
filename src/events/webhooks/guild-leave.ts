import { BracketClient } from "@/base/classes/client";
import { Event } from "@/base/classes/event";
import config from "@/config";
import { Guild, WebhookClient, EmbedBuilder, Colors } from "discord.js";

export default class GuildLeave extends Event<"guildDelete"> {
  public event = "guildDelete" as const;
  private webhookClient: WebhookClient | null = null;

  constructor(client: BracketClient) {
    super(client);
    if (config.GUILD_LOGS_WEBHOOK_URL) {
      this.webhookClient = new WebhookClient({
        url: config.GUILD_LOGS_WEBHOOK_URL,
      });
    }
  }

  async execute(guild: Guild): Promise<void> {
    if (!this.webhookClient) return;

    try {
      const embed = new EmbedBuilder()
        .setTitle("📤 Left a Guild")
        .setColor(Colors.Red)
        .setThumbnail(guild.iconURL({ size: 128 }) ?? null)
        .addFields(
          { name: "Guild Name", value: guild.name, inline: true },
          { name: "Guild ID", value: guild.id, inline: true },
          {
            name: "Members",
            value: guild.memberCount.toString(),
            inline: true,
          },
        )
        .setFooter({ text: `Total guilds: ${this.client.guilds.cache.size}` })
        .setTimestamp();

      await this.webhookClient.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to send guild leave notification:", error);
    }
  }
}
