import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(rootDir, 'index.html'),
        powerup: resolve(rootDir, 'powerup.html'),
        cardBack: resolve(rootDir, 'card-back.html'),
        settings: resolve(rootDir, 'settings.html'),
        logs: resolve(rootDir, 'logs.html'),
        preview: resolve(rootDir, 'preview.html'),
      },
    },
  },
});
