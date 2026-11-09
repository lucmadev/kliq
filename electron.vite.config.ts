import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

const renderer = resolve("src/renderer/src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        "import.meta.env.GOOGLE_CLIENT_ID": JSON.stringify(env.GOOGLE_CLIENT_ID ?? ""),
        "import.meta.env.GOOGLE_CLIENT_SECRET": JSON.stringify(env.GOOGLE_CLIENT_SECRET ?? ""),
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          output: {
            format: "cjs",
            entryFileNames: "[name].cjs",
          },
        },
      },
    },
    renderer: {
      resolve: {
        alias: {
          "@": renderer,
          "@renderer": renderer,
        },
      },
      plugins: [react(), tailwindcss()],
    },
  };
});
