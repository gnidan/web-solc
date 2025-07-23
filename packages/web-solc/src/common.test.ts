import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSolc, resolveSolc } from "./common.js";

describe("common", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSolc", () => {
    it("should fetch compatible solc version", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.18.js", longVersion: "0.8.18+commit.87f61d96" },
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
          { path: "soljson-v0.8.20.js", longVersion: "0.8.20+commit.a1b79de6" },
          { path: "soljson-v0.8.21.js", longVersion: "0.8.21+commit.d9974bed" },
        ],
      };

      const mockSoljson = "mock solc compiler code";

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => mockBuilds,
        } as Response)
        .mockResolvedValueOnce({
          text: async () => mockSoljson,
        } as Response);

      const result = await fetchSolc("^0.8.19");

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/list.json"
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/soljson-v0.8.21.js"
      );
      expect(result).toBe(mockSoljson);
    });

    it("should respect custom base URL", async () => {
      const customBaseUrl = "https://custom.solc.host";
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
        ],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => mockBuilds,
        } as Response)
        .mockResolvedValueOnce({
          text: async () => "mock content",
        } as Response);

      await fetchSolc("0.8.19", {
        repository: { baseUrl: customBaseUrl },
      });

      expect(global.fetch).toHaveBeenCalledWith(`${customBaseUrl}/list.json`);
      expect(global.fetch).toHaveBeenCalledWith(
        `${customBaseUrl}/soljson-v0.8.19.js`
      );
    });

    it("should throw error when no compatible version found", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.7.0.js", longVersion: "0.7.0+commit.9e61f92b" },
          { path: "soljson-v0.7.1.js", longVersion: "0.7.1+commit.f4a555be" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      await expect(fetchSolc("^0.8.0")).rejects.toThrow(
        "Could not find solc version to satisfy requested range ^0.8.0"
      );
    });

    it("should filter builds by version range correctly", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.17.js", longVersion: "0.8.17+commit.8df45f5f" },
          { path: "soljson-v0.8.18.js", longVersion: "0.8.18+commit.87f61d96" },
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
          { path: "soljson-v0.8.20.js", longVersion: "0.8.20+commit.a1b79de6" },
        ],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => mockBuilds,
        } as Response)
        .mockResolvedValueOnce({
          text: async () => "mock content",
        } as Response);

      await fetchSolc(">=0.8.18 <0.8.20");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/soljson-v0.8.19.js"
      );
    });

    it("should handle empty builds array", async () => {
      const mockBuilds = { builds: [] };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      await expect(fetchSolc("*")).rejects.toThrow(
        "Could not find solc version to satisfy requested range *"
      );
    });

    it("should pass options correctly", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
        ],
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => mockBuilds,
        } as Response)
        .mockResolvedValueOnce({
          text: async () => "mock content",
        } as Response);

      const options = { repository: { baseUrl: "https://example.com" } };
      await fetchSolc("0.8.19", options);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/list.json"
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/soljson-v0.8.19.js"
      );
    });
  });

  describe("resolveSolc", () => {
    it("should resolve version range to exact version and path", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.18.js", longVersion: "0.8.18+commit.87f61d96" },
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
          { path: "soljson-v0.8.20.js", longVersion: "0.8.20+commit.a1b79de6" },
          { path: "soljson-v0.8.21.js", longVersion: "0.8.21+commit.d9974bed" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      const result = await resolveSolc("^0.8.19");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/list.json"
      );
      expect(result).toEqual({
        version: "0.8.21",
        path: "soljson-v0.8.21.js",
      });
    });

    it("should extract version without commit hash", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.26.js", longVersion: "0.8.26+commit.8a97fa7a" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      const result = await resolveSolc("0.8.26");

      expect(result.version).toBe("0.8.26");
      expect(result.path).toBe("soljson-v0.8.26.js");
    });

    it("should resolve '*' to the most recent version", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.24.js", longVersion: "0.8.24+commit.e11b9ed9" },
          { path: "soljson-v0.8.25.js", longVersion: "0.8.25+commit.b61c2a91" },
          { path: "soljson-v0.8.26.js", longVersion: "0.8.26+commit.8a97fa7a" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      const result = await resolveSolc("*");

      expect(result.version).toBe("0.8.26");
      expect(result.path).toBe("soljson-v0.8.26.js");
    });

    it("should handle complex version ranges", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.17.js", longVersion: "0.8.17+commit.8df45f5f" },
          { path: "soljson-v0.8.18.js", longVersion: "0.8.18+commit.87f61d96" },
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
          { path: "soljson-v0.8.20.js", longVersion: "0.8.20+commit.a1b79de6" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      const result = await resolveSolc(">=0.8.18 <0.8.20");

      expect(result.version).toBe("0.8.19");
      expect(result.path).toBe("soljson-v0.8.19.js");
    });

    it("should respect custom base URL", async () => {
      const customBaseUrl = "https://custom.solc.host";
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      await resolveSolc("0.8.19", {
        repository: { baseUrl: customBaseUrl },
      });

      expect(global.fetch).toHaveBeenCalledWith(`${customBaseUrl}/list.json`);
    });

    it("should throw error when no compatible version found", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.7.0.js", longVersion: "0.7.0+commit.9e61f92b" },
          { path: "soljson-v0.7.1.js", longVersion: "0.7.1+commit.f4a555be" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      await expect(resolveSolc("^0.8.0")).rejects.toThrow(
        "Could not find solc version to satisfy requested range ^0.8.0"
      );
    });

    it("should handle empty builds array", async () => {
      const mockBuilds = { builds: [] };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      await expect(resolveSolc("*")).rejects.toThrow(
        "Could not find solc version to satisfy requested range *"
      );
    });
  });
});
