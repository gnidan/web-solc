import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSolc } from "./node.js";
import * as common from "./common.js";

// Mock the common module
vi.mock("./common.js", () => ({
  fetchLatestReleasedSoljsonSatisfyingVersionRange: vi.fn(),
}));

describe("node", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSolc", () => {
    it("should create a WebSolc instance with compile and stopWorker methods", async () => {
      // Create a mock Solidity compiler module
      const mockSoljsonText = `
        Module.onRuntimeInitialized = null;
        Module.cwrap = function(name, returnType, argTypes) {
          return function(input) {
            // Mock compile function that returns valid JSON
            const parsed = JSON.parse(input);
            return JSON.stringify({
              contracts: {},
              sources: {},
              errors: []
            });
          };
        };
        
        // Simulate async initialization
        if (Module.onRuntimeInitialized) {
          setTimeout(() => Module.onRuntimeInitialized(), 0);
        }
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const solc = await fetchSolc("^0.8.0");

      expect(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).toHaveBeenCalledWith("^0.8.0", undefined);
      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
      expect(typeof solc.compile).toBe("function");
      expect(typeof solc.stopWorker).toBe("function");
    });

    it("should pass options to fetchLatestReleasedSoljsonSatisfyingVersionRange", async () => {
      const mockSoljsonText = `
        Module.cwrap = () => () => '{}';
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const options = { repository: { baseUrl: "https://custom.url" } };
      await fetchSolc("^0.8.0", options);

      expect(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).toHaveBeenCalledWith("^0.8.0", options);
    });

    it("should compile Solidity code correctly", async () => {
      const mockCompileResult = {
        contracts: {
          "test.sol": {
            Test: {
              abi: [],
              evm: { bytecode: { object: "0x" } },
            },
          },
        },
        sources: {},
        errors: [],
      };

      const mockSoljsonText = `
        Module.cwrap = function(name, returnType, argTypes) {
          return function(input) {
            return JSON.stringify(${JSON.stringify(mockCompileResult)});
          };
        };
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const solc = await fetchSolc("^0.8.0");

      const input = {
        language: "Solidity",
        sources: {
          "test.sol": {
            content: "contract Test {}",
          },
        },
      };

      const result = solc.compile(input);
      expect(result).toEqual(mockCompileResult);
    });

    it("should handle compilation errors", async () => {
      const mockSoljsonText = `
        Module.cwrap = function() {
          return function(input) {
            throw new Error('Compilation failed');
          };
        };
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const solc = await fetchSolc("^0.8.0");

      expect(() => {
        solc.compile({ language: "Solidity", sources: {} });
      }).toThrow("Compilation failed");
    });

    it("should handle module initialization errors", async () => {
      const mockSoljsonText = `
        // Module.cwrap is not defined, which should cause an error
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      await expect(fetchSolc("^0.8.0")).rejects.toThrow(
        "Module.cwrap is not a function"
      );
    });

    it("should handle async module initialization", async () => {
      const mockSoljsonText = `
        // Simulate async initialization
        Module.onRuntimeInitialized = () => {};
        setTimeout(() => {
          Module.cwrap = () => () => '{"contracts":{}}';
          Module.onRuntimeInitialized();
        }, 10);
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const solc = await fetchSolc("^0.8.0");
      expect(solc.compile).toBeDefined();
    });

    it("stopWorker should be a no-op", async () => {
      const mockSoljsonText = `
        Module.cwrap = () => () => '{}';
      `;

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const solc = await fetchSolc("^0.8.0");

      // Should not throw
      expect(() => solc.stopWorker()).not.toThrow();
    });
  });

  describe("loadSolc", () => {
    it("should create a WebSolc instance from provided soljson text", async () => {
      const mockSoljsonText = `
        Module.cwrap = () => () => '{"contracts":{"test.sol":{"Test":{}}}}';
      `;

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljsonText);

      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should compile using provided soljson", async () => {
      const mockSoljsonText = `
        Module.cwrap = () => (input) => {
          const parsed = JSON.parse(input);
          return JSON.stringify({
            contracts: {
              [Object.keys(parsed.sources)[0]]: {
                Test: { abi: [], evm: { bytecode: { object: "0x60" } } }
              }
            }
          });
        };
      `;

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljsonText);

      const input = {
        language: "Solidity",
        sources: {
          "test.sol": { content: "contract Test {}" },
        },
      };

      const result = await solc.compile(input);
      expect(result).toHaveProperty("contracts");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).contracts["test.sol"]).toHaveProperty("Test");
    });
  });
});
