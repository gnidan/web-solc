import { describe, it, expect, vi } from "vitest";
import { loadSolc } from "./node.js";
import { compilerInterfaces } from "./interface.js";

describe("compatibility options", () => {
  describe("loadSolc with options", () => {
    it("should accept LoadOptions parameter", async () => {
      const mockSoljson = `
        Module._solidity_compile = function() {};
        Module.cwrap = () => () => '{"contracts": {}}';
      `;

      // Should not throw
      await expect(
        loadSolc(mockSoljson, {
          compatibility: {
            disableCompilerInterfaces: ["legacy"],
          },
        })
      ).resolves.toBeDefined();
    });

    it("should disable specific compiler interfaces", async () => {
      // Mock with only legacy API (compileStandard)
      const mockSoljson = `
        Module._compileStandard = function() {};
        Module.cwrap = function(name) {
          if (name === "compileStandard" || name === "_compileStandard") {
            return () => '{"contracts": {}}';
          }
          throw new Error("Function not found: " + name);
        };
      `;

      // Should work without disabling
      const solc1 = await loadSolc(mockSoljson);
      expect(solc1).toBeDefined();

      // Should throw when disabling legacy adapter
      await expect(
        loadSolc(mockSoljson, {
          compatibility: {
            disableCompilerInterfaces: ["legacy"],
          },
        })
      ).rejects.toThrow("No compatible Solidity compiler API found");
    });
  });

  describe("fetchAndLoadSolc with options", () => {
    it("should accept both fetch and load options", async () => {
      // This test mainly verifies the TypeScript interface works correctly
      const { fetchAndLoadSolc } = await import("./node.js");
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ builds: [] }),
      } as Response);

      // Should accept the combined options
      await expect(
        fetchAndLoadSolc("^0.8.0", {
          fetch: {
            repository: { baseUrl: "https://test.com" },
          },
          load: {
            compatibility: {
              disableCompilerInterfaces: [
                compilerInterfaces.legacy,
                compilerInterfaces.modern,
              ],
            },
          },
        })
      ).rejects.toThrow(); // Will throw because no compatible version found
    });
  });

  describe("compiler interface constants", () => {
    it("should export the correct interface names", () => {
      expect(compilerInterfaces.legacy).toBe("legacy");
      expect(compilerInterfaces.modern).toBe("modern");
    });
  });
});
