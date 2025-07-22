import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
