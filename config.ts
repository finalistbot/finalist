import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  BOT_TOKEN: z.string(),
  DEVELOPER_GUILD_ID: z.string().optional(),
});

export default schema.parse(process.env);
