/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          pptx: ['pptxgenjs', 'jszip'],
          codemirror: ['@uiw/react-codemirror', '@codemirror/lang-json', '@codemirror/lang-javascript', '@codemirror/lang-html'],
          katex: ['katex'],
          xlsx: ['xlsx'],
          pdf: ['jspdf', 'html-to-image'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'server/tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
