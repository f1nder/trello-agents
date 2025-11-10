import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  publicDir: "public", // Explicitly set public directory for static files
  plugins: [react()],
  build: {
    copyPublicDir: true, // Ensure static files are always copied during build
    rollupOptions: {
      input: {
        app: resolve(rootDir, "index.html"),
        powerup: resolve(rootDir, "powerup.html"),
        cardBack: resolve(rootDir, "card-back.html"),
        settings: resolve(rootDir, "settings.html"),
        logs: resolve(rootDir, "logs.html"),
        preview: resolve(rootDir, "preview.html"),
      },
    },
  },
});
