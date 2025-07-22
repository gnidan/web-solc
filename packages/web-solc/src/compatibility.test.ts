import { describe, it, expect, vi } from "vitest";
import { loadSolc } from "./node.js";
import { legacyInterfaces } from "./interface.js";

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
            disableLegacyInterfaceAdapters: ["compile-json"],
          },
        })
      ).resolves.toBeDefined();
    });

    it("should disable specific legacy interface adapters", async () => {
      // Mock with only compileStandard (no modern API)
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

      // Should throw when disabling compileStandard adapter
      await expect(
        loadSolc(mockSoljson, {
          compatibility: {
            disableLegacyInterfaceAdapters: ["compile-standard"],
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
              disableLegacyInterfaceAdapters: [
                legacyInterfaces.compileJson,
                legacyInterfaces.compileJsonMulti,
              ],
            },
          },
        })
      ).rejects.toThrow(); // Will throw because no compatible version found
    });
  });

  describe("legacy interface constants", () => {
    it("should export the correct interface names", () => {
      expect(legacyInterfaces.compileJson).toBe("compile-json");
      expect(legacyInterfaces.compileJsonMulti).toBe("compile-json-multi");
      expect(legacyInterfaces.compileStandard).toBe("compile-standard");
      expect(legacyInterfaces.solidityCompile).toBe("solidity-compile");
    });
  });
});
