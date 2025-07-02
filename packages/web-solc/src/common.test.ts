import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLatestReleasedSoljsonSatisfyingVersionRange } from "./common.js";

describe("common", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchLatestReleasedSoljsonSatisfyingVersionRange", () => {
    it("should fetch compatible solc version", async () => {
      const mockBuilds = {
        builds: [
          { path: "soljson-v0.8.18.js", longVersion: "0.8.18+commit.87f61d96" },
          { path: "soljson-v0.8.19.js", longVersion: "0.8.19+commit.7dd6d404" },
          { path: "soljson-v0.8.20.js", longVersion: "0.8.20+commit.a1b79de6" },
          { path: "soljson-v0.8.21.js", longVersion: "0.8.21+commit.d9974bed" },
        ],
      };

      const mockSoljsonContent = "mock solc compiler code";

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          json: async () => mockBuilds,
        } as Response)
        .mockResolvedValueOnce({
          text: async () => mockSoljsonContent,
        } as Response);

      const result =
        await fetchLatestReleasedSoljsonSatisfyingVersionRange("^0.8.19");

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/list.json"
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/soljson-v0.8.21.js"
      );
      expect(result).toBe(mockSoljsonContent);
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

      await fetchLatestReleasedSoljsonSatisfyingVersionRange("0.8.19", {
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

      await expect(
        fetchLatestReleasedSoljsonSatisfyingVersionRange("^0.8.0")
      ).rejects.toThrow(
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

      await fetchLatestReleasedSoljsonSatisfyingVersionRange(
        ">=0.8.18 <0.8.20"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://binaries.soliditylang.org/bin/soljson-v0.8.19.js"
      );
    });

    it("should handle empty builds array", async () => {
      const mockBuilds = { builds: [] };

      global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => mockBuilds,
      } as Response);

      await expect(
        fetchLatestReleasedSoljsonSatisfyingVersionRange("*")
      ).rejects.toThrow(
        "Could not find solc version to satisfy requested range *"
      );
    });
  });
});
