"use server";

import {
  APIGuild,
  type APIGuildChannel,
  type APIRole,
  Routes,
} from "discord-api-types/v10";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { discordRest } from "@/lib/discord";
import { requireGuildAdmin } from "@/lib/guild";
import { redis } from "@/lib/redis";
import { getUserToken } from "@/lib/user";

const GUILD_DATA_CACHE_TTL = 300; // 5 minutes in seconds

async function getCached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  refresh = false
): Promise<T> {
  if (!refresh) {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}

export async function getGuildChannels(
  guildId: string,
  refresh = false
): Promise<APIGuildChannel[]> {
  const CACHE_KEY = `guild:${guildId}:channels`;

  await requireGuildAdmin(guildId);

  return getCached(
    CACHE_KEY,
    GUILD_DATA_CACHE_TTL,
    async () => {
      try {
        const channels = await discordRest.get(Routes.guildChannels(guildId));
        return channels as APIGuildChannel[];
      } catch (error) {
        throw new Error(
          `Failed to fetch guild channels: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    refresh
  );
}

export async function getGuildRoles(
  guildId: string,
  refresh = false
): Promise<APIRole[]> {
  const CACHE_KEY = `guild:${guildId}:roles`;

  await requireGuildAdmin(guildId);

  return getCached(
    CACHE_KEY,
    GUILD_DATA_CACHE_TTL,
    async () => {
      try {
        const roles = await discordRest.get(Routes.guildRoles(guildId));
        return roles as APIRole[];
      } catch (error) {
        throw new Error(
          `Failed to fetch guild roles: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    refresh
  );
}

export async function getUserGuilds(): Promise<APIGuild[]> {
  const auth = await requireAuth();
  const { id } = auth.user;
  const accessToken = await getUserToken(id);

  if (!accessToken) {
    throw new Error("User access token not found");
  }

  const CACHE_KEY = `user:${id}:guilds`;

  return getCached(CACHE_KEY, GUILD_DATA_CACHE_TTL, async () => {
    try {
      const userGuilds = await discordRest.get(Routes.userGuilds(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return userGuilds as APIGuild[];
    } catch (error) {
      throw new Error(
        `Failed to fetch user guilds: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

export async function getGuildConfig(guildId: string) {
  await requireGuildAdmin(guildId);
  const config = await prisma.guildConfig.findUnique({
    where: { id: guildId },
  });
  return config;
}

export async function upsertGuildConfig(guildId: string, adminRoleId: string) {
  await requireGuildAdmin(guildId);
  const config = await prisma.guildConfig.upsert({
    where: { id: guildId },
    create: {
      id: guildId,
      adminRoleId,
    },
    update: {
      adminRoleId,
    },
  });
  return config;
}

export async function getGuild(guildId: string): Promise<APIGuild> {
  await requireGuildAdmin(guildId);
  const guilds = await getUserGuilds();
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) {
    throw new Error("Guild not found or access denied");
  }
  return guild;
}
