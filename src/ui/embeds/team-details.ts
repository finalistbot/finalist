import { BRAND_COLOR, MAX_TEAM_SIZE } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { Team } from '@prisma/client'
import { EmbedBuilder } from 'discord.js'

export default async function teamDetailsEmbed(team: Team) {
  const teamMembers = await prisma.teamMember.findMany({
    where: { teamId: team.id },
  })
  const captain = teamMembers.find((m) => m.role === 'CAPTAIN')
  const members = teamMembers.filter((m) => m.role === 'MEMBER')
  const substitutes = teamMembers.filter((m) => m.role === 'SUBSTITUTE')

  // Build member lists
  let description = ''
  if (captain) {
    description += `**Captain:**\n<@${captain.userId}> - ${captain.ingameName}\n\n`
  }

  if (members.length > 0) {
    description += `**Members:** (${members.length})\n`
    members.forEach((member, index) => {
      description += `${index + 1}. <@${member.userId}> - ${member.ingameName}\n`
    })
    description += '\n'
  }

  if (substitutes.length > 0) {
    description += `**Substitutes:** (${substitutes.length})\n`
    substitutes.forEach((sub, index) => {
      description += `${index + 1}. <@${sub.userId}> - ${sub.ingameName}\n`
    })
  }

  const embed = new EmbedBuilder()
    .setTitle(`${team.name}${team.tag ? ` [${team.tag}]` : ''}`)
    .setColor(team.banned ? 0xff0000 : BRAND_COLOR)
    .setDescription(description || 'No members found.')
    .addFields(
      { name: 'Team Code', value: `\`${team.code}\``, inline: true },
      {
        name: 'Total Members',
        value: `${teamMembers.length}/${MAX_TEAM_SIZE}`,
        inline: true,
      },
      {
        name: 'Status',
        value: team.banned ? '🚫 Banned' : '✅ Active',
        inline: true,
      }
    )
    .setFooter({ text: `Team ID: ${team.id}` })
    .setTimestamp()

  return embed
}
