import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAndLoadSolc, fetchSolc } from "./browser.js";
import * as common from "./common.js";

// Mock the common module
vi.mock("./common.js", () => ({
  fetchSolc: vi.fn(),
}));

// Mock the worker module
vi.mock("./solc.worker.js", () => ({
  default: () => {
    self.onmessage = (_event: MessageEvent) => {
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

  describe("fetchAndLoadSolc", () => {
    it("should create a WebSolc instance with compile and stopWorker methods", async () => {
      const mockSoljson = "mock solc compiler code";
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

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

      const solc = await fetchAndLoadSolc("^0.8.0");

      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0");
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.Worker).toHaveBeenCalledWith("blob:mock-url");
      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should pass options to fetchSolc", async () => {
      const mockSoljson = "mock solc compiler code";
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

      global.Worker = vi.fn().mockImplementation(() => ({
        postMessage: vi.fn(),
        terminate: vi.fn(),
      })) as unknown as typeof Worker;

      const options = { repository: { baseUrl: "https://custom.url" } };
      await fetchAndLoadSolc("^0.8.0", { fetch: options });

      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0", options);
    });

    it("should handle compile request through worker", async () => {
      const mockSoljson = "mock solc compiler code";
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchAndLoadSolc("^0.8.0");

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
        disabledInterfaces: [],
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
      const mockSoljson = "mock solc compiler code";
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((error: ErrorEvent) => void) | null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchAndLoadSolc("^0.8.0");

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
      const mockSoljson = "mock solc compiler code";
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
      };

      global.Worker = vi
        .fn()
        .mockImplementation(() => mockWorker) as unknown as typeof Worker;

      const solc = await fetchAndLoadSolc("^0.8.0");

      solc.stopWorker();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  describe("fetchSolc", () => {
    it("should return soljson string", async () => {
      const mockSoljson = "mock soljson";
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

      const result = await fetchSolc("^0.8.0");

      expect(result).toBe(mockSoljson);
      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0");
    });

    it("should pass options correctly", async () => {
      const mockSoljson = "mock soljson";
      const options = { repository: { baseUrl: "https://custom.url" } };
      vi.mocked(common).fetchSolc.mockResolvedValue(mockSoljson);

      const result = await fetchSolc("^0.8.0", options);

      expect(result).toBe(mockSoljson);
      expect(common.fetchSolc).toHaveBeenCalledWith("^0.8.0", options);
    });
  });

  describe("loadSolc", () => {
    it("should create a WebSolc instance from provided soljson", async () => {
      const mockSoljson = "mock solc compiler code";

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
      const solc = await loadSolc(mockSoljson);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.Worker).toHaveBeenCalledWith("blob:mock-url");
      expect(solc).toHaveProperty("compile");
      expect(solc).toHaveProperty("stopWorker");
    });

    it("should compile using provided soljson", async () => {
      const mockSoljson = "mock solc compiler code";

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
      const solc = await loadSolc(mockSoljson);

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
        disabledInterfaces: [],
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

    it("should pass compatibility options to worker", async () => {
      const mockSoljson = "mock solc compiler code";

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
      const solc = await loadSolc(mockSoljson, {
        compatibility: {
          disableCompilerInterfaces: ["legacy"],
        },
      });

      const input = { language: "Solidity", sources: {} };
      solc.compile(input);

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        soljsonUrl: "blob:mock-url",
        input,
        disabledInterfaces: ["legacy"],
      });
    });
  });
});
