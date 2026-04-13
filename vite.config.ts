import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    host: true,
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  run: {
    cache: true,
  },
});
