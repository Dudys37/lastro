/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → funciona no GitHub Pages em qualquer subcaminho de repositório
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
