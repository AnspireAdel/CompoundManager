import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { isStaging, PRODUCTION_ORIGIN, STAGING_ORIGIN } from './src/constants/api';

const proxyTarget = isStaging ? STAGING_ORIGIN : PRODUCTION_ORIGIN;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': proxyTarget,
      '/uploads': proxyTarget,
    },
  },
});
