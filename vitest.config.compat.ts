import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["compat/**/*.test.ts"],
    testTimeout: 120000, // 2 minutes per test for slow versions
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
