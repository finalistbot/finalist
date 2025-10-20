import { prisma } from '@/lib/prisma'
import { ScrimPreset } from '@prisma/client'
import { User } from 'discord.js'

export async function getFirstAvailableSlot(scrimId: number) {
  const query = prisma.$queryRaw<{ slot: number }[]>`
  SELECT COALESCE(MIN(s.slot_number), -1) AS slot
  FROM generate_series(
    1, 
    (SELECT max_teams FROM scrim WHERE scrim.id = ${scrimId})
  ) AS s(slot_number)
  WHERE s.slot_number NOT IN (
    SELECT slot_number 
    FROM assigned_slot WHERE scrim_id = ${scrimId}
    UNION
    SELECT slot_number 
    FROM reserved_slot WHERE scrim_id = ${scrimId}
  );
`
  const result = await query
  return result[0]?.slot ?? -1
}

export async function filterPresets(guildId: string, search?: string) {
  let presets
  if (!search || search.length < 1) {
    presets = await prisma.scrimPreset.findMany({
      where: { guildId },
      take: 10,
      select: { name: true },
    })
  } else {
    presets = await prisma.$queryRaw<ScrimPreset[]>`
        SELECT name FROM scrim_preset WHERE guild_id = ${guildId} 
          AND SIMILARITY(name, ${search}) > 0.1
            ORDER BY SIMILARITY(name, ${search}) DESC LIMIT 10;`
  }
  return presets
}

export async function ensureUser(user: User) {
  return await prisma.user.upsert({
    where: { id: user.id },
    update: {
      name: user.username,
      avatarUrl: user.avatarURL(),
    },
    create: {
      id: user.id,
      name: user.username,
      avatarUrl: user.avatarURL(),
    },
  })
}
