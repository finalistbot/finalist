import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional().default(6379),

  BOT_TOKEN: z.string(),
  DEVELOPER_GUILD_ID: z.string().optional(),
});

export default schema.parse(process.env);
