import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { TestCase } from "../packages/web-solc/tests/test-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Error test case
const errorSource = readFileSync(
  resolve(__dirname, "../packages/web-solc/tests/contracts/error.sol"),
  "utf-8"
);

export const errorTestCase: TestCase = {
  version: "0.8.19",
  description: "Contract with syntax error",
  contract: {
    fileName: "error.sol",
    source: errorSource,
    contractName: "ErrorContract",
  },
  assertions: [
    { path: "errors", operator: "exists" },
    {
      path: "errors",
      operator: "length",
      value: 0,
      description: "Has compilation errors",
    },
    {
      path: "errors[0].severity",
      operator: "equals",
      value: "error",
      description: "First error has error severity",
    },
    {
      path: "errors[0].message",
      operator: "contains",
      value: "Expected",
      description: "Error message contains 'Expected'",
    },
  ],
};
