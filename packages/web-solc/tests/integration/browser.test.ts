import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "@playwright/test";
import { createServer, ViteDevServer } from "vite";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

  it("should compile Solidity code using the actual web-solc package", async () => {
    // Read the local soljson file
    const soljsonPath = resolve(__dirname, "../fixtures/soljson-v0.8.19.js");
    const soljsonText = readFileSync(soljsonPath, "utf-8");

    // Navigate to the test page
    await page.goto(`${serverUrl}/test.html`);

    // Wait for the module to load
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => typeof (window as any).runTest === "function",
      {
        timeout: 10000,
      }
    );

    // Run the test
    const result = await page.evaluate(async (soljsonContent) => {
      // @ts-expect-error window.runTest is defined in test.html
      return await window.runTest(soljsonContent);
    }, soljsonText);

    // Verify the results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedResult = result as any;
    expect(typedResult.success).toBe(true);
    expect(typedResult.contractName).toBe("Test");
    expect(typedResult.hasAbi).toBe(true);
    expect(typedResult.hasBytecode).toBe(true);
    expect(typedResult.abiLength).toBeGreaterThan(0);
    expect(typedResult.bytecodeLength).toBeGreaterThan(0);
  }, 60000);

  it("should compile different Solidity versions with advanced features", async () => {
    // Read a different soljson version
    const soljsonPath = resolve(__dirname, "../fixtures/soljson-v0.8.25.js");
    const soljsonText = readFileSync(soljsonPath, "utf-8");

    // Create a new test page with advanced contract
    await page.goto(`${serverUrl}/test.html`);

    // Wait for the module to load
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => typeof (window as any).runTest === "function",
      {
        timeout: 10000,
      }
    );

    // Define custom test for advanced features
    await page.evaluate(() => {
      // Override the test to use a more complex contract
      // @ts-expect-error window.runAdvancedTest is dynamically defined
      window.runAdvancedTest = async (soljsonText: string) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const solc = (window as any).loadSolc(soljsonText);

          const input = {
            language: "Solidity",
            sources: {
              "advanced.sol": {
                content: `
                  pragma solidity ^0.8.25;
                  
                  contract Advanced {
                      uint256 public constant VALUE = 42;
                      mapping(address => uint256) public balances;
                      
                      event ValueRead(uint256 value);
                      event BalanceUpdated(address indexed user, uint256 newBalance);
                      
                      modifier onlyPositive(uint256 amount) {
                          require(amount > 0, "Amount must be positive");
                          _;
                      }
                      
                      function readValue() public pure returns (uint256) {
                          return VALUE;
                      }
                      
                      function updateBalance(uint256 amount) public onlyPositive(amount) {
                          balances[msg.sender] = amount;
                          emit BalanceUpdated(msg.sender, amount);
                      }
                  }
                `,
              },
            },
            settings: {
              outputSelection: {
                "*": {
                  "*": ["*"],
                },
              },
              optimizer: {
                enabled: true,
                runs: 200,
              },
            },
          };

          const output = await solc.compile(input);
          solc.stopWorker();

          if (!output || typeof output !== "object") {
            throw new Error("Invalid output format");
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((output as any).errors && (output as any).errors.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const criticalErrors = (output as any).errors.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (e: any) => e.severity === "error"
            );
            if (criticalErrors.length > 0) {
              throw new Error(
                "Compilation errors: " + JSON.stringify(criticalErrors)
              );
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contract = (output as any).contracts?.["advanced.sol"]?.[
            "Advanced"
          ];
          if (!contract) {
            throw new Error("Contract not found in output");
          }

          // Verify the contract has expected elements
          const hasConstant = contract.abi?.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item: any) => item.name === "VALUE" && item.type === "function"
          );
          const hasMapping = contract.abi?.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item: any) => item.name === "balances" && item.type === "function"
          );
          const hasEvents =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            contract.abi?.filter((item: any) => item.type === "event")
              .length === 2;
          const hasModifier = contract.evm?.bytecode?.object?.length > 500; // Complex contract should have more bytecode

          return {
            success: true,
            contractName: "Advanced",
            hasAbi: !!contract.abi,
            hasBytecode: !!contract.evm?.bytecode?.object,
            hasConstant,
            hasMapping,
            hasEvents,
            hasModifier,
            optimizerEnabled: true,
            abiLength: contract.abi?.length || 0,
            bytecodeLength: contract.evm?.bytecode?.object?.length || 0,
          };
        } catch (error) {
          return {
            success: false,
            // @ts-expect-error error type is unknown
            error: error.message || String(error),
          };
        }
      };
    });

    // Wait for loadSolc to be available (it's loaded in test.html)
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => typeof (window as any).loadSolc === "function",
      {
        timeout: 10000,
      }
    );

    // Run the advanced test
    const result = await page.evaluate(async (soljsonContent) => {
      // @ts-expect-error window.runAdvancedTest is defined above
      return await window.runAdvancedTest(soljsonContent);
    }, soljsonText);

    // Verify the results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedResult = result as any;
    if (!typedResult.success) {
      console.error("Test failed:", typedResult.error);
    }
    expect(typedResult.success).toBe(true);
    expect(typedResult.contractName).toBe("Advanced");
    expect(typedResult.hasAbi).toBe(true);
    expect(typedResult.hasBytecode).toBe(true);
    expect(typedResult.hasConstant).toBe(true);
    expect(typedResult.hasMapping).toBe(true);
    expect(typedResult.hasEvents).toBe(true);
    expect(typedResult.hasModifier).toBe(true);
    expect(typedResult.optimizerEnabled).toBe(true);
    expect(typedResult.abiLength).toBeGreaterThan(5); // Should have multiple functions/events
    expect(typedResult.bytecodeLength).toBeGreaterThan(500); // Optimized bytecode should still be substantial
  }, 60000);
});
