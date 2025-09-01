import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  BOT_TOKEN: z.string(),
});

export default schema.parse(process.env);
