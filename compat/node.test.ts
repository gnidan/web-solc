import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  testCases,
  errorTestCase,
  createCompileInput,
  verifyCompilationOutput,
  runAssertions,
} from "./test-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Node.js Integration Tests", () => {
  // Generate tests from data
  for (const testCase of testCases) {
    // Test both wasm and emscripten builds
    for (const build of ["wasm", "emscripten"] as const) {
      it(`should compile ${testCase.description} (v${testCase.version}, ${build})`, async () => {
        const soljsonPath = resolve(
          __dirname,
          `../packages/web-solc/vendor/${build}/soljson-v${testCase.version}.js`
        );

        // Check if soljson file exists
        let soljson: string;
        try {
          soljson = readFileSync(soljsonPath, "utf-8");
        } catch {
          // Skip test if this version doesn't exist for this build
          throw new Error(
            `Version ${testCase.version} not available for ${build} build - file not found at ${soljsonPath}`
          );
        }

        // Import and load the compiler
        const { loadSolc } = await import(
          "../packages/web-solc/dist/src/node.js"
        );
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
      });
    }
  }

  // Error test case - only test with emscripten as it's just for error handling
  it("should handle compilation errors gracefully (emscripten)", async () => {
    const soljsonPath = resolve(
      __dirname,
      `../packages/web-solc/vendor/emscripten/soljson-v${errorTestCase.version}.js`
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

    const { loadSolc } = await import("../packages/web-solc/dist/src/node.js");
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
