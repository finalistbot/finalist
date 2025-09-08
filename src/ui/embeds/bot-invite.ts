import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

export function botInviteEmbed() {
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=1414234980757799104&scope=bot%20applications.commands&permissions=8`;

  return new EmbedBuilder()
    .setTitle("🔗 Invite Me!")
    .setDescription("Manage scrims in your Discord server with Finalist Bot!")
    .setFooter({ text: "Click the button below to get started." })
    .setColor(0x5865f2);
}

export async function sendBotInviteEmbed(
  channel: TextChannel,
  clientID: string
) {
  const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientID}&scope=bot%20applications.commands&permissions=8`;
  const discordInviteURL = "https://discord.gg/yCdASUuQ";
  const embed = botInviteEmbed();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("➕ Invite Me")
      .setStyle(ButtonStyle.Link)
      .setURL(botInviteUrl),
    new ButtonBuilder()
      .setLabel("💬 Support Server")
      .setStyle(ButtonStyle.Link)
      .setURL(discordInviteURL)
  );
  await channel.send({ embeds: [embed], components: [row] });
}
