import { Command } from "@/base/classes/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { prisma } from "@/lib/prisma";
import { stringify as csvStringify } from "csv-stringify/sync";
import { table } from "table";
import { CommandError } from "@/base/classes/error";

type SlotDetails = {
  slotNumber: number;
  teamName: string;
  teamId: number;
  jumpUrl: string;
};

function slotsToCSV(slots: SlotDetails[]) {
  return csvStringify(slots, {
    header: true,
    columns: ["slotNumber", "teamName", "teamId", "jumpUrl"],
  });
}

function slotsToHTML(slots: SlotDetails[]) {
  const rows = slots
    .map(
      (slot) => `
    <tr>
      <td>${slot.slotNumber}</td>
      <td>${slot.teamName}</td>
      <td>${slot.teamId}</td>
      <td><a target="_blank" href="${slot.jumpUrl}">Jump to Team</a></td>
    </tr>
  `,
    )
    .join("\n");
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Slotlist</title>
    <style>
      table {
        width: 100%;    
        border-collapse: collapse;
      } 
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
      }
      th {
        background-color: #f2f2f2;
        text-align: left;
      }
    </style>
  </head>
  <body>
    <h1>Slotlist</h1>
    <table>
      <thead>
        <tr>
          <th>Slot Number</th>
          <th>Team Name</th>
          <th>Team ID</th>
          <th>Jump URL</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
  </html>
  `;
}

function slotsToTable(slots: SlotDetails[]) {
  const data = [
    ["Slot Number", "Team Name", "Team ID", "Jump URL"],
    ...slots.map((slot) => [
      slot.slotNumber,
      slot.teamName,
      slot.teamId,
      slot.jumpUrl,
    ]),
  ];
  return table(data);
}

export default class SlotlistExport extends Command {
  data = new SlashCommandBuilder()
    .setName("slotlist")
    .setDescription("Send slotlist in current channel in specified format")
    .addStringOption((option) =>
      option
        .setName("format")
        .setDescription("The format to export the slotlist in")
        .setRequired(false)
        .addChoices(
          { name: "Embedded", value: "embed" },
          { name: "CSV", value: "csv" },
          { name: "Table", value: "table" },
          { name: "HTML", value: "html" },
        ),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const format = interaction.options.getString("format") || "embed";
    await interaction.deferReply({ flags: "Ephemeral" });

    const scrim = await prisma.scrim.findFirst({
      where: {
        adminChannelId: interaction.channelId,
      },
      include: {
        AssignedSlot: {
          include: {
            team: {
              include: {
                TeamMember: true,
              },
            },
          },
          orderBy: {
            slotNumber: "asc",
          },
        },
      },
    });

    if (!scrim) {
      return interaction.editReply(
        "This command can only be used in a scrim admin channel.",
      );
    }
    const slots = scrim.AssignedSlot;
    if (slots.length === 0) {
      return interaction.editReply("No slots found.");
    }
    const slotDetails: SlotDetails[] = slots.map((slot) => ({
      slotNumber: slot.slotNumber,
      teamName: slot.team ? slot.team.name : "Unassigned",
      teamId: slot.team.id,
      jumpUrl: slot.team
        ? `https://discord.com/channels/${interaction.guildId}/${scrim.participantsChannelId}/${slot.team.messageId}`
        : "N/A",
    }));
    let message = "";
    let attachmentName = "";
    let attachmentData: string | Buffer;
    switch (format) {
      case "csv":
        attachmentName = "slotlist.csv";
        attachmentData = slotsToCSV(slotDetails);
        message = "Here is the slotlist, you can view it in a spreadsheet.";
        break;
      case "html":
        attachmentName = "slotlist.html";
        attachmentData = slotsToHTML(slotDetails);
        message = "Here is the slotlist, you can view it in a web browser.";
        break;
      case "embed":
        throw new CommandError(
          "Embed format is not supported for file export. Please choose CSV, HTML, or Table.",
        );
      case "table":
      default:
        attachmentName = "slotlist.txt";
        attachmentData = slotsToTable(slotDetails);
        message = "Here is the slotlist, you can view it in a text editor.";
        break;
    }
    return interaction.editReply({
      content: message,
      files: [
        {
          attachment: Buffer.from(attachmentData),
          name: attachmentName,
        },
      ],
    });
  }
}
