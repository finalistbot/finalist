import { config } from "@/config";
import { prisma } from "@/lib/db";

export async function getUserToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId: userId, providerId: "discord" },
  });
  if (!account || !account.accessToken) {
    return null;
  }

  const bufferMs = 5 * 60 * 1000;
  if (!account.accessTokenExpiresAt) {
    return account.accessToken;
  }
  const expiresAt = account.accessTokenExpiresAt.getTime();
  const now = Date.now();

  if (now + bufferMs < expiresAt) {
    return account.accessToken;
  }

  console.log("Access token expired or about to expire, refreshing...");

  if (!account.refreshToken) {
    return null;
  }

  try {
    const body = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    });
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("Discord refresh failed:", response.status, text);
      return null;
    }
    const data = JSON.parse(text);
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    await prisma.account.update({
      where: { id: account.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        accessTokenExpiresAt: expiresAt,
      },
    });
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}
