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
      root: resolve(__dirname),
      server: {
        port: 0, // Use any available port
      },
      resolve: {
        alias: {
          "/dist": resolve(__dirname, "../../dist"),
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

    // Enable console logging for debugging
    page.on("console", (msg) => {
      console.log("Browser console:", msg.text());
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
    const testFn = testCase.skip ? it.skip : it;

    testFn(
      `should compile ${testCase.description} (v${testCase.version})`,
      async () => {
        const soljsonPath = resolve(
          __dirname,
          `../fixtures/soljson-v${testCase.version}.js`
        );
        const soljsonText = readFileSync(soljsonPath, "utf-8");

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
          { testName, soljsonContent: soljsonText }
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typedResult = result as any;
        if (!typedResult.success) {
          throw new Error(`Test failed: ${typedResult.error}`);
        }

        // Run assertions on the contract
        runAssertions(typedResult.contract, testCase.assertions);
      },
      60000
    );
  }

  // Error test case
  it("should handle compilation errors gracefully", async () => {
    const soljsonPath = resolve(
      __dirname,
      `../fixtures/soljson-v${errorTestCase.version}.js`
    );
    const soljsonText = readFileSync(soljsonPath, "utf-8");

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
      { testName, soljsonContent: soljsonText }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedResult = result as any;
    expect(typedResult.success).toBe(true);

    // Run assertions on the output
    runAssertions(typedResult.output, errorTestCase.assertions);
  }, 60000);
});
