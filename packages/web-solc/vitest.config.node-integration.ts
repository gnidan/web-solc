import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "node-integration",
    include: ["tests/integration/node.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["./test-setup.ts"],
  },
});
