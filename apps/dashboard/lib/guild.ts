import { APIGuild, PermissionsBitField } from "discord.js";
import { requireAuth } from "./auth";
import { getUserGuilds } from "@/actions/guild";

export async function requireGuildAdmin(guildId: string): Promise<void> {
  await requireAuth();
  const userGuilds = await getUserGuilds();

  if (!isGuildAdmin(guildId, userGuilds)) {
    throw new Error("User does not have admin permissions in this guild.");
  }
}

function isGuildAdmin(guildId: string, userGuilds: APIGuild[]): boolean {
  const guild = userGuilds.find((g) => g.id === guildId);
  if (!guild) {
    return false;
  }
  const perms = new PermissionsBitField(BigInt(guild.permissions || 0));
  return perms.has(PermissionsBitField.Flags.ManageGuild);
}
