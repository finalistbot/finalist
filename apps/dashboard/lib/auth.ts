import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";

import { prisma } from "./db";

import { config } from "@/config";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    modelName: "webUser",
  },
  socialProviders: {
    discord: {
      clientId: config.DISCORD_CLIENT_ID,
      clientSecret: config.DISCORD_CLIENT_SECRET,
      scope: ["identify", "email", "guilds"],
    },
  },
});

/**
 * Get the current authenticated user's session in server actions/components
 * @throws Error if user is not authenticated
 */
export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return session;
}
