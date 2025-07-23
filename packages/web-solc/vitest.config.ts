import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./test-setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts*"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,js}"],
      exclude: ["**/*.d.ts", "**/node_modules/**", "**/dist/**"],
    },
  },
});
