// Re-export all shared types and utilities
export * from "../packages/web-solc/tests/test-utils.js";

// Import the compatibility test cases
export { testCases } from "./version-test-generator.js";
export { errorTestCase } from "./error-test-case.js";
