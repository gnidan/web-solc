import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "@playwright/test";
import { createServer, ViteDevServer } from "vite";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  testCases,
  errorTestCase,
  createBrowserTestRunner,
  runAssertions,
} from "./test-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Browser Integration Tests", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let serverUrl: string;

  beforeAll(async () => {
    // Start Vite server
    server = await createServer({
      root: resolve(__dirname, "../packages/web-solc/tests"),
      server: {
        port: 0, // Use any available port
      },
      resolve: {
        alias: {
          "/dist": resolve(__dirname, "../packages/web-solc/dist"),
        },
      },
      configFile: false,
    });

    await server.listen();
    const address = server.httpServer?.address();
    const port = typeof address === "object" && address ? address.port : 3000;
    serverUrl = `http://localhost:${port}`;

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    // Enable console logging for debugging (only errors, not vite connection messages)
    page.on("console", (msg) => {
      const text = msg.text();
      // Skip vite connection messages
      if (
        text.includes("[vite]") &&
        (text.includes("connecting") || text.includes("connected"))
      ) {
        return;
      }
      // Only log warnings and errors
      if (msg.type() === "warning" || msg.type() === "error") {
        console.log("Browser console:", text);
      }
    });

    page.on("pageerror", (err) => {
      console.error("Browser error:", err);
    });
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  // Generate tests from data
  for (const testCase of testCases) {
    it(`should compile ${testCase.description} (v${testCase.version})`, async () => {
      try {
        const soljsonPath = resolve(
          __dirname,
          `../packages/web-solc/vendor/soljson-v${testCase.version}.js`
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

        // Navigate to the test page
        await page.goto(`${serverUrl}/test.html`);

        // Wait for loadSolc to be available
        await page.waitForFunction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => typeof (window as any).loadSolc === "function",
          { timeout: 10000 }
        );

        // Create unique test name
        const testName = `test_v${testCase.version.replace(/\./g, "_")}_${testCase.contract.contractName}`;

        // Inject the test runner
        await page.evaluate(
          (testCode) => {
            // eslint-disable-next-line no-eval
            eval(testCode);
          },
          createBrowserTestRunner(testName, testCase)
        );

        // Run the test
        const result = await page.evaluate(
          async ({ testName, soljsonContent }) => {
            // @ts-expect-error dynamically created function
            return await window[testName](soljsonContent);
          },
          { testName, soljsonContent: soljson }
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typedResult = result as any;
        if (!typedResult.success) {
          throw new Error(`Test failed: ${typedResult.error}`);
        }

        // Run assertions on the contract
        runAssertions(typedResult.contract, testCase.assertions);
      } catch (error) {
        // Expected failures for certain versions
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("RangeError: Maximum call stack size exceeded")
        ) {
          throw new Error(
            "Browser stack overflow - version too large for browser execution"
          );
        }
        throw error;
      }
    }, 120000);
  }

  // Error test case
  it("should handle compilation errors gracefully", async () => {
    const soljsonPath = resolve(
      __dirname,
      `../packages/web-solc/vendor/soljson-v${errorTestCase.version}.js`
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

    await page.goto(`${serverUrl}/test.html`);

    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => typeof (window as any).loadSolc === "function",
      { timeout: 10000 }
    );

    const testName = "test_error";

    // Inject the test runner for error case
    await page.evaluate(
      (testCode) => {
        // eslint-disable-next-line no-eval
        eval(testCode);
      },
      createBrowserTestRunner(testName, errorTestCase)
    );

    const result = await page.evaluate(
      async ({ testName, soljsonContent }) => {
        // @ts-expect-error dynamically created function
        return await window[testName](soljsonContent);
      },
      { testName, soljsonContent: soljson }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedResult = result as any;
    expect(typedResult.success).toBe(true);

    // Run assertions on the output
    runAssertions(typedResult.output, errorTestCase.assertions);
  }, 60000);
});
