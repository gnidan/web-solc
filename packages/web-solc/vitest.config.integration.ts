import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    // Note: These integration tests demonstrate the structure for browser testing
    // but use mocks for the actual Solidity compilation to avoid network dependencies
    // in CI. For full end-to-end testing, the tests would need to:
    // 1. Build the package first
    // 2. Serve the built files via a local server
    // 3. Load the actual web-solc in the browser
    // 4. Download real Solidity compiler from binaries.soliditylang.org
  },
});
