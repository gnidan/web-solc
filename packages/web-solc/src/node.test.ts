import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAndLoadSolc, fetchSolc } from "./node.js";
import * as common from "./common.js";

// Mock the common module
vi.mock("./common.js", () => ({
  fetchSolc: vi.fn(),
}));

// Helper to create mock soljson with proper exports
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

  describe("fetchAndLoadSolc", () => {
    it("should create a WebSolc instance with compile and stopWorker methods", async () => {
      const mockSoljson = createMockSoljson();

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const solc = await fetchAndLoadSolc("^0.8.0");

      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0");
      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
      expect(typeof solc.compile).toBe("function");
      expect(typeof solc.stopWorker).toBe("function");
    });

    it("should pass options to fetchSolc", async () => {
      const mockSoljson = createMockSoljson();

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const options = { repository: { baseUrl: "https://custom.url" } };
      await fetchAndLoadSolc("^0.8.0", { fetch: options });

      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0", options);
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

      const mockSoljson = createMockSoljson("modern", mockCompileResult);

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const solc = await fetchAndLoadSolc("^0.8.0");

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
      const mockSoljson = `
        Module._solidity_compile = function() {}; // Export marker
        Module.cwrap = function() {
          return function(input) {
            throw new Error('Compilation failed');
          };
        };
      `;

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const solc = await fetchAndLoadSolc("^0.8.0");

      expect(() => {
        solc.compile({ language: "Solidity", sources: {} });
      }).toThrow("Compilation failed");
    });

    it("should handle module initialization errors", async () => {
      const mockSoljson = `
        // Module.cwrap is not defined, which should cause an error
      `;

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      await expect(fetchAndLoadSolc("^0.8.0")).rejects.toThrow(
        "Module.cwrap is not a function"
      );
    });

    it("should handle async module initialization", async () => {
      const mockSoljson = `
        // Simulate async initialization
        Module._solidity_compile = function() {}; // Export marker
        Module.onRuntimeInitialized = () => {};
        setTimeout(() => {
          Module.cwrap = () => () => '{"contracts":{}}';
          Module.onRuntimeInitialized();
        }, 10);
      `;

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const solc = await fetchAndLoadSolc("^0.8.0");
      expect(solc.compile).toBeDefined();
    });

    it("stopWorker should be a no-op", async () => {
      const mockSoljson = createMockSoljson();

      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const solc = await fetchAndLoadSolc("^0.8.0");

      // Should not throw
      expect(() => solc.stopWorker()).not.toThrow();
    });
  });

  describe("fetchSolc", () => {
    it("should return soljson string", async () => {
      const mockSoljson = "mock soljson";
      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const result = await fetchSolc("^0.8.0");

      expect(result).toBe(mockSoljson);
      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0");
    });

    it("should pass options correctly", async () => {
      const mockSoljson = "mock soljson";
      const options = { repository: { baseUrl: "https://custom.url" } };
      vi.mocked(common.fetchSolc).mockResolvedValue(mockSoljson);

      const result = await fetchSolc("^0.8.0", options);

      expect(result).toBe(mockSoljson);
      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0", options);
    });
  });

  describe("loadSolc", () => {
    it("should create a WebSolc instance from provided soljson", async () => {
      const mockSoljson = createMockSoljson();

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljson);

      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should compile using provided soljson", async () => {
      const mockSoljson = `
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
      const solc = await loadSolc(mockSoljson);

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
      const mockSoljson = createMockSoljson("compileStandard", {
        contracts: { "test.sol": { Test: { abi: [] } } },
      });

      const { loadSolc } = await import("./node.js");
      const solc = await loadSolc(mockSoljson);

      const result = await solc.compile({ sources: {} });
      expect(result).toHaveProperty("contracts");
    });

    it("should throw if no compatible API is found", async () => {
      const mockSoljson = `
        Module.cwrap = function(name) {
          throw new Error("Function not found: " + name);
        };
      `;

      const { loadSolc } = await import("./node.js");
      await expect(loadSolc(mockSoljson)).rejects.toThrow(
        "No compatible Solidity compiler API found"
      );
    });
  });
});
