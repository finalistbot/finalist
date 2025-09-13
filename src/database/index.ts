import { prisma } from "@/lib/prisma";

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
`;
  const result = await query;
  return result[0]?.slot ?? -1;
}
