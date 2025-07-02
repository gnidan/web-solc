import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts", "**/node_modules/**", "**/dist/**"],
    },
  },
});
