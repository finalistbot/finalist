import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  REDIS_URL: z.string().min(1, "REDIS_HOST is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET is required"),
  DISCORD_REDIRECT_URI: z.string().min(1, "DISCORD_REDIRECT_URI is required"),
});

export const config = ConfigSchema.parse(process.env);
