import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSolc } from "./node.js";
import * as common from "./common.js";

// Mock the common module
vi.mock("./common.js", () => ({
  fetchLatestReleasedSoljsonSatisfyingVersionRange: vi.fn(),
}));

// Helper to create mock soljson text with proper exports
const createMockSoljson = (
  api:
    | "modern"
    | "compileStandard"
    | "compileJSONMulti"
    | "compileJSON" = "modern",
  compileResult = { contracts: {}, sources: {}, errors: [] }
) => {
  const exportMarker = {
    modern: "Module._solidity_compile = function() {};",
    compileStandard: "Module._compileStandard = function() {};",
    compileJSONMulti: "Module._compileJSONMulti = function() {};",
    compileJSON: "Module._compileJSON = function() {};",
  }[api];

  return `
    ${exportMarker}
    Module.cwrap = function(name, returnType, argTypes) {
      return function(input) {
        return JSON.stringify(${JSON.stringify(compileResult)});
      };
    };
  `;
};

describe("node", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSolc", () => {
    it("should create a WebSolc instance with compile and stopWorker methods", async () => {
      const mockSoljsonText = createMockSoljson();

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
      const mockSoljsonText = createMockSoljson();

      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const options = { repository: { baseUrl: "https://custom.url" } };
      await fetchSolc("^0.8.0", options);

      expect(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).toHaveBeenCalledWith("^0.8.0", {
        repository: { baseUrl: "https://custom.url" },
      });
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

      const mockSoljsonText = createMockSoljson("modern", mockCompileResult);

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
        Module._solidity_compile = function() {}; // Export marker
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
        Module._solidity_compile = function() {}; // Export marker
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
      const mockSoljsonText = createMockSoljson();

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
      const mockSoljsonText = createMockSoljson();

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljsonText);

      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should compile using provided soljson", async () => {
      const mockSoljsonText = `
        Module._solidity_compile = function() {}; // Export marker
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

    it("should support legacy compileStandard API (0.4.11+)", async () => {
      const mockSoljsonText = createMockSoljson("compileStandard", {
        contracts: { "test.sol": { Test: { abi: [] } } },
      });

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljsonText);

      const result = await solc.compile({ sources: {} });
      expect(result).toHaveProperty("contracts");
    });

    it("should support legacy compileJSONMulti API", async () => {
      const mockSoljsonText = createMockSoljson("compileJSONMulti", {
        contracts: { "test.sol": { Test: { abi: [] } } },
      });

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljsonText);

      const result = await solc.compile({ sources: {} });
      expect(result).toHaveProperty("contracts");
    });

    it("should support oldest compileJSON API", async () => {
      const mockSoljsonText = createMockSoljson("compileJSON", {
        contracts: { "test.sol": { Test: { abi: [] } } },
      });

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljsonText);

      const result = await solc.compile({ sources: {} });
      expect(result).toHaveProperty("contracts");
    });

    it("should throw if no compatible API is found", async () => {
      const mockSoljsonText = `
        Module.cwrap = function(name) {
          throw new Error("Function not found: " + name);
        };
      `;

      const { loadSolc } = await import("./node.js");
      await expect(loadSolc(mockSoljsonText)).rejects.toThrow(
        "No compatible Solidity compiler API found"
      );
    });
  });
});
