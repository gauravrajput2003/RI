import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: { include: ['test/migrations.integration.ts'], fileParallelism: false, testTimeout: 60000, hookTimeout: 30000 },
});
