import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createCompileInput,
  verifyCompilationOutput,
  runAssertions,
} from "../tests/test-utils.js";
import { testCases, errorTestCase } from "../tests/integration-test-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Node.js Integration Tests", () => {
  // Generate tests from data
  for (const testCase of testCases) {
    const testFn = testCase.skip ? it.skip : it;

    testFn(
      `should compile ${testCase.description} (v${testCase.version})`,
      async () => {
        const soljsonPath = resolve(
          __dirname,
          `../vendor/wasm/soljson-v${testCase.version}.js`
        );

        // Check if soljson file exists
        let soljson: string;
        try {
          soljson = readFileSync(soljsonPath, "utf-8");
        } catch {
          throw new Error(
            `Solidity compiler v${testCase.version} not found at ${soljsonPath}.\n` +
              `Please run: cd packages/web-solc && yarn test:compat:download`
          );
        }

        // Import and load the compiler
        const { loadSolc } = await import("../dist/src/node.js");
        const solc = await loadSolc(soljson);

        try {
          // Create compile input from test case
          const input = createCompileInput(testCase);

          // Compile
          const output = await solc.compile(input);

          // Verify output and get contract
          const { contract: compiledContract } = verifyCompilationOutput(
            output,
            testCase.contract.fileName,
            testCase.contract.contractName
          );

          // Run assertions
          runAssertions(compiledContract, testCase.assertions);
        } finally {
          // Cleanup (no-op in Node.js)
          solc.stopWorker();
        }
      }
    );
  }

  // Error test case
  it("should handle compilation errors gracefully", async () => {
    const soljsonPath = resolve(
      __dirname,
      `../vendor/wasm/soljson-v${errorTestCase.version}.js`
    );

    // Check if soljson file exists
    let soljson: string;
    try {
      soljson = readFileSync(soljsonPath, "utf-8");
    } catch {
      throw new Error(
        `Solidity compiler v${errorTestCase.version} not found at ${soljsonPath}.\n` +
          `Please run: cd packages/web-solc && yarn test:compat:download`
      );
    }

    const { loadSolc } = await import("../dist/src/node.js");
    const solc = await loadSolc(soljson);

    try {
      const input = createCompileInput(errorTestCase);
      const output = await solc.compile(input);

      // Run assertions on the output
      runAssertions(output, errorTestCase.assertions);
    } finally {
      solc.stopWorker();
    }
  });
});
