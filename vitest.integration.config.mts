import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
