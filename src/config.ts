import { z } from "zod";

const envSchema = z.object({
  LOKI_URL: z.string().default("http://localhost:3100"),
  LOKI_USERNAME: z.string().optional(),
  LOKI_PASSWORD: z.string().optional(),
});

const processEnv = envSchema.parse(process.env);

export const config = {
  lokiUrl: processEnv.LOKI_URL,
  lokiUsername: processEnv.LOKI_USERNAME,
  lokiPassword: processEnv.LOKI_PASSWORD,
};
