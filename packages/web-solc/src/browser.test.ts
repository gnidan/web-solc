import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSolc } from "./browser.js";
import * as common from "./common.js";

// Mock the common module
vi.mock("./common.js", () => ({
  fetchLatestReleasedSoljsonSatisfyingVersionRange: vi.fn(),
}));

// Mock the worker module
vi.mock("./solc.worker.js", () => ({
  default: () => {
    self.onmessage = (_event: MessageEvent) => {
      // const { soljsonText, input } = event.data;
      // Simulate compiler output
      self.postMessage(
        JSON.stringify({
          contracts: {},
          sources: {},
          errors: [],
        })
      );
    };
  },
}));

describe("browser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  describe("fetchSolc", () => {
    it("should create a WebSolc instance with compile and stopWorker methods", async () => {
      const mockSoljsonText = "mock solc compiler code";
      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      // Mock Worker
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchSolc("^0.8.0");

      expect(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).toHaveBeenCalledWith("^0.8.0", undefined);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.Worker).toHaveBeenCalledWith("blob:mock-url");
      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should pass options to fetchLatestReleasedSoljsonSatisfyingVersionRange", async () => {
      const mockSoljsonText = "mock solc compiler code";
      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      global.Worker = vi.fn().mockImplementation(() => ({
        postMessage: vi.fn(),
        terminate: vi.fn(),
      })) as unknown as typeof Worker;

      const options = { repository: { baseUrl: "https://custom.url" } };
      await fetchSolc("^0.8.0", options);

      expect(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).toHaveBeenCalledWith("^0.8.0", options);
    });

    it("should handle compile request through worker", async () => {
      const mockSoljsonText = "mock solc compiler code";
      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchSolc("^0.8.0");

      const input = {
        language: "Solidity",
        sources: {
          "test.sol": {
            content: "contract Test {}",
          },
        },
      };

      const compilePromise = solc.compile(input);

      // Verify postMessage was called with correct data
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        soljsonUrl: "blob:mock-url",
        input,
      });

      // Simulate worker response
      const mockOutput = JSON.stringify({
        contracts: { "test.sol": {} },
        sources: {},
        errors: [],
      });

      if (mockWorker.onmessage) {
        mockWorker.onmessage({ data: mockOutput } as MessageEvent);
      }

      const result = await compilePromise;
      expect(result).toBe(mockOutput);
    });

    it("should handle worker errors", async () => {
      const mockSoljsonText = "mock solc compiler code";
      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchSolc("^0.8.0");

      // Start the compile
      const input = { language: "Solidity", sources: {} };
      const compilePromise = solc.compile(input);

      // Simulate worker error
      const error = new Error("Worker error");
      if (mockWorker.onerror) {
        mockWorker.onerror(error as unknown as ErrorEvent);
      }

      await expect(compilePromise).rejects.toThrow("Worker error");
    });

    it("should cleanup worker and blob URL on stopWorker", async () => {
      const mockSoljsonText = "mock solc compiler code";
      vi.mocked(
        common.fetchLatestReleasedSoljsonSatisfyingVersionRange
      ).mockResolvedValue(mockSoljsonText);

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchSolc("^0.8.0");

      solc.stopWorker();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  describe("loadSolc", () => {
    it("should create a WebSolc instance from provided soljson text", async () => {
      const mockSoljsonText = "mock solc compiler code";

      // Mock Worker
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;
      global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      const { loadSolc } = await import("./browser.js");
      const solc = loadSolc(mockSoljsonText);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.Worker).toHaveBeenCalledWith("blob:mock-url");
      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should compile using provided soljson", async () => {
      const mockSoljsonText = "mock solc compiler code";

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const { loadSolc } = await import("./browser.js");
      const solc = loadSolc(mockSoljsonText);

      const input = {
        language: "Solidity",
        sources: {
          "test.sol": {
            content: "contract Test {}",
          },
        },
      };

      const compilePromise = solc.compile(input);

      // Verify postMessage was called with correct data
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        soljsonUrl: "blob:mock-url",
        input,
      });

      // Simulate worker response
      const mockOutput = JSON.stringify({
        contracts: { "test.sol": {} },
        sources: {},
        errors: [],
      });

      if (mockWorker.onmessage) {
        mockWorker.onmessage({ data: mockOutput } as MessageEvent);
      }

      const result = await compilePromise;
      expect(result).toBe(mockOutput);
    });
  });
});
