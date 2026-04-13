import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {},
  clientPrefix: "VITE_",
  client: {
    VITE_TTP_API_BASE_URL: z.url().default("http://localhost:3001"),
  },
  runtimeEnv: import.meta.env,
  isServer: typeof window === "undefined",
  emptyStringAsUndefined: true,
});
