import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test-setup.ts"],
    coverage: {
      reporter: ["text", "html", "json"],
      include: ["packages/*/src/**/*.{ts,tsx,js,jsx}"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.d.ts",
        "**/test-*.js",
        "**/example/**",
      ],
    },
  },
  resolve: {
    alias: {
      "web-solc": path.resolve(__dirname, "packages/web-solc/src"),
      "@web-solc/react": path.resolve(__dirname, "packages/react/src"),
    },
  },
});
