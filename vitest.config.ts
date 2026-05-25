import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setupTests.ts',
    include: [
      'app/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'utils/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'test/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  cacheDir: './.vitest',
});
