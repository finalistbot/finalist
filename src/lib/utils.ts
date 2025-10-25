import { Interaction } from "discord.js";

import { InteractionCheck } from "@/base/classes/check";
import { CheckFailure } from "@/base/classes/error";

export function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function discordTimestamp(date: Date, format: string = "f"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
}

export function mentionUser(userId: string): string {
  return `<@${userId}>`;
}

export async function suppress<T>(
  promise: Promise<T> | T,
  defaultValue: T | null = null
): Promise<T | null> {
  try {
    return await promise;
  } catch (e) {
    return defaultValue;
  }
}

export function parseIdFromString(
  event: string,
  pos: number = 1
): number | undefined {
  const split = event.split(":");
  if (split.length < pos + 1) return undefined;
  const id = parseInt(split[pos]!);
  if (isNaN(id)) return undefined;
  return id;
}

export function convertToTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function convertToSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");
}

export async function safeRunChecks(
  interaction: Interaction,
  ...checks: InteractionCheck[]
): Promise<
  | {
      success: true;
    }
  | { success: false; reason: string }
> {
  for (const check of checks) {
    let success = false;
    try {
      success = await check(interaction);
    } catch (e) {
      if (e instanceof CheckFailure) {
        return { success: false, reason: e.message };
      }
    }
    if (!success) {
      return {
        success: false,
        reason: "A check for this interaction is failed.",
      };
    }
  }
  return {
    success: true,
  };
}
