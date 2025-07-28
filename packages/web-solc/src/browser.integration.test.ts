import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "@playwright/test";
import { createServer, ViteDevServer } from "vite";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createBrowserTestRunner, runAssertions } from "../tests/test-utils.js";
import { testCases, errorTestCase } from "../tests/integration-test-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Browser Integration Tests", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let serverUrl: string;

  beforeAll(async () => {
    // Start Vite server with HMR disabled to prevent reload issues
    server = await createServer({
      root: resolve(__dirname, "../tests"),
      server: {
        port: 0, // Use any available port
        hmr: false, // Disable HMR to prevent unexpected reloads
      },
      resolve: {
        alias: {
          "/dist": resolve(__dirname, "../dist"),
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

    // Handle page crashes
    page.on("crash", () => {
      console.error("Page crashed!");
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

        // Navigate to the test page
        await page.goto(`${serverUrl}/test.html`, {
          waitUntil: "networkidle", // Wait for network to be idle
        });

        // Add a small delay to ensure page is fully stable
        await page.waitForTimeout(100);

        // Wait for loadSolc to be available with explicit timeout
        await page.waitForFunction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => typeof (window as any).loadSolc === "function",
          { timeout: 10000 }
        );

        // Create unique test name
        const testName = `test_v${testCase.version.replace(/\./g, "_")}_${testCase.contract.contractName}`;

        // Inject the test runner with error handling
        try {
          await page.evaluate(
            (testCode) => {
              // eslint-disable-next-line no-eval
              eval(testCode);
            },
            createBrowserTestRunner(testName, testCase)
          );
        } catch (error) {
          // If evaluation failed due to navigation, retry once
          if (error.message?.includes("Execution context was destroyed")) {
            console.warn(
              `Retrying test for ${testCase.version} due to context destruction`
            );

            // Re-navigate and wait
            await page.goto(`${serverUrl}/test.html`, {
              waitUntil: "networkidle",
            });
            await page.waitForTimeout(200);

            await page.waitForFunction(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              () => typeof (window as any).loadSolc === "function",
              { timeout: 10000 }
            );

            await page.evaluate(
              (testCode) => {
                // eslint-disable-next-line no-eval
                eval(testCode);
              },
              createBrowserTestRunner(testName, testCase)
            );
          } else {
            throw error;
          }
        }

        // Run the test with retry logic
        let result;
        try {
          result = await page.evaluate(
            async ({ testName, soljsonContent }) => {
              // @ts-expect-error dynamically created function
              return await window[testName](soljsonContent);
            },
            { testName, soljsonContent: soljson }
          );
        } catch (error) {
          // If evaluation failed due to navigation, retry once
          if (error.message?.includes("Execution context was destroyed")) {
            console.warn(
              `Retrying execution for ${testCase.version} due to context destruction`
            );

            // Wait a bit for any pending operations
            await page.waitForTimeout(500);

            // Check if page is still valid
            try {
              await page.evaluate(() => document.readyState);
            } catch {
              // Page is gone, need to reload
              await page.goto(`${serverUrl}/test.html`, {
                waitUntil: "networkidle",
              });
              await page.waitForTimeout(200);

              // Re-inject everything
              await page.waitForFunction(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                () => typeof (window as any).loadSolc === "function",
                { timeout: 10000 }
              );

              await page.evaluate(
                (testCode) => {
                  // eslint-disable-next-line no-eval
                  eval(testCode);
                },
                createBrowserTestRunner(testName, testCase)
              );
            }

            // Retry the test
            result = await page.evaluate(
              async ({ testName, soljsonContent }) => {
                // @ts-expect-error dynamically created function
                return await window[testName](soljsonContent);
              },
              { testName, soljsonContent: soljson }
            );
          } else {
            throw error;
          }
        }

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

    await page.goto(`${serverUrl}/test.html`, {
      waitUntil: "networkidle",
    });

    // Add a small delay to ensure page is fully stable
    await page.waitForTimeout(100);

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
