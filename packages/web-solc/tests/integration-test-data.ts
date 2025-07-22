import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { TestCase } from "./test-utils.js";
import {
  getContractForVersion,
  representativeVersions,
} from "./contracts/version-mapping.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create test cases from representative versions
export const testCases: TestCase[] = representativeVersions.map((version) => {
  const { fileName, contractName } = getContractForVersion(version);
  const source = readFileSync(
    resolve(__dirname, "contracts", fileName),
    "utf-8"
  );

  return {
    version,
    description: `Solidity ${version}`,
    contract: {
      fileName: "test.sol", // Always use test.sol as the compilation unit name
      source,
      contractName,
    },
    assertions: [
      { path: "abi", operator: "exists" },
      { path: "evm.bytecode.object", operator: "exists" },
      {
        path: "evm.bytecode.object",
        operator: "length",
        value: 10,
        description: "Has bytecode",
      },
    ],
  };
});

// Error test case
const errorSource = readFileSync(
  resolve(__dirname, "contracts", "error.sol"),
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
