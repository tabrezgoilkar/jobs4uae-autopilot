import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // server tests (JS) + pure web utility tests (.ts only — component .tsx tests would need jsdom).
    include: ['server/**/*.test.js', 'web/src/**/*.test.ts'],
  },
});
