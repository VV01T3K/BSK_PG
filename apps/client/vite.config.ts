import { defineConfig } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";

const config = defineConfig(({ mode }) => ({
  server: {
    host: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    mode === "test" ? undefined : nitro({ preset: "bun" }),
    viteReact(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
}));

export default config;
