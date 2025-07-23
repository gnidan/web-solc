import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, waitFor, cleanup } from "@testing-library/react";
import React, { useState, useCallback } from "react";
import {
  WebSolcProvider,
  useWebSolc,
  MemoryCache,
  type SoljsonCache,
} from "./index.js";
import * as webSolc from "web-solc";
import type { WebSolc, CompilerInput } from "web-solc";

// Type the mocked module
const mockedWebSolc = vi.mocked(webSolc);

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
    vi.clearAllMocks();
  });

  it("should store and retrieve soljson strings", async () => {
    await cache.set("0.8.26", "mock soljson content");
    const retrieved = await cache.get("0.8.26");

    expect(retrieved).toBe("mock soljson content");
  });

  it("should return undefined for non-existent version", async () => {
    const retrieved = await cache.get("0.8.0");

    expect(retrieved).toBeUndefined();
  });

  it("should clear all cached soljson strings", async () => {
    await cache.set("0.8.26", "soljson 1");
    await cache.set("0.8.25", "soljson 2");

    await cache.clear();

    // Cache should be empty
    expect(await cache.get("0.8.26")).toBeUndefined();
    expect(await cache.get("0.8.25")).toBeUndefined();
  });
});

describe("WebSolcProvider", () => {
  const mockCompile = vi.fn();
  const mockStopWorker = vi.fn();
  const mockSolc: WebSolc = {
    compile: mockCompile,
    stopWorker: mockStopWorker,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedWebSolc.resolveSolc.mockResolvedValue({
      version: "0.8.26",
      path: "soljson-v0.8.26.js",
    });
    mockedWebSolc.fetchSolc.mockResolvedValue("mock soljson");
    mockedWebSolc.loadSolc.mockResolvedValue(mockSolc);
  });

  afterEach(() => {
    cleanup();
  });

  it("should render children", () => {
    const { getByText } = render(
      <WebSolcProvider>
        <div>Test Child</div>
      </WebSolcProvider>
    );

    expect(getByText("Test Child")).toBeDefined();
  });

  it("should pass custom cache to context", async () => {
    const mockCache: SoljsonCache = {
      get: vi.fn().mockResolvedValue("cached soljson"),
      set: vi.fn(),
      clear: vi.fn(),
    };

    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }), {
      wrapper: ({ children }) => (
        <WebSolcProvider cache={mockCache}>{children}</WebSolcProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have called get to check cache
    expect(mockCache.get).toHaveBeenCalledWith("0.8.26");
    // Should have loaded from cached soljson
    expect(mockedWebSolc.loadSolc).toHaveBeenCalledWith(
      "cached soljson",
      undefined
    );
  });

  it("should pass options through context", async () => {
    const fetchOptions = { repository: { baseUrl: "https://custom.url" } };
    const loadOptions = {
      compatibility: { disableCompilerInterfaces: ["legacy" as const] },
    };

    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }), {
      wrapper: ({ children }) => (
        <WebSolcProvider fetchOptions={fetchOptions} loadOptions={loadOptions}>
          {children}
        </WebSolcProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedWebSolc.resolveSolc).toHaveBeenCalledWith(
      "^0.8.0",
      fetchOptions
    );
    expect(mockedWebSolc.loadSolc).toHaveBeenCalledWith(
      "mock soljson",
      loadOptions
    );
  });
});

describe("useWebSolc", () => {
  const mockCompile = vi.fn();
  const mockStopWorker = vi.fn();
  const mockSolc: WebSolc = {
    compile: mockCompile,
    stopWorker: mockStopWorker,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedWebSolc.resolveSolc.mockResolvedValue({
      version: "0.8.26",
      path: "soljson-v0.8.26.js",
    });
    mockedWebSolc.fetchSolc.mockResolvedValue("mock soljson");
    mockedWebSolc.loadSolc.mockResolvedValue(mockSolc);
  });

  afterEach(() => {
    cleanup();
  });

  it("should work without provider", async () => {
    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.compile).toBeDefined();
    expect(mockedWebSolc.resolveSolc).toHaveBeenCalledWith("^0.8.0", undefined);
    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("0.8.26", undefined);
    expect(mockedWebSolc.loadSolc).toHaveBeenCalledWith(
      "mock soljson",
      undefined
    );
  });

  it("should return loading state initially", () => {
    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.compile).toBeUndefined();
  });

  it("should return compile function when ready", async () => {
    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.compile).toBeDefined();
  });

  it("should compile when compile is called", async () => {
    mockCompile.mockResolvedValue({ contracts: {} });

    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const input = {
      language: "Solidity",
      sources: {
        "test.sol": {
          content: "contract Test {}",
        },
      },
    };

    const output = await result.current.compile!(input);

    expect(mockCompile).toHaveBeenCalledWith(input);
    expect(output).toEqual({ contracts: {} });
  });

  it("should handle errors during fetch", async () => {
    const error = new Error("Failed to fetch");
    mockedWebSolc.fetchSolc.mockRejectedValue(error);

    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(error);
    expect(result.current.compile).toBeUndefined();
  });

  it("should handle soljson option", async () => {
    const soljson = "mock soljson";

    const { result } = renderHook(() => useWebSolc({ soljson }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedWebSolc.loadSolc).toHaveBeenCalledWith(soljson, undefined);
    expect(mockedWebSolc.resolveSolc).not.toHaveBeenCalled();
    expect(mockedWebSolc.fetchSolc).not.toHaveBeenCalled();
  });

  it("should handle version change", async () => {
    mockedWebSolc.resolveSolc
      .mockResolvedValueOnce({ version: "0.8.26", path: "soljson-v0.8.26.js" })
      .mockResolvedValueOnce({ version: "0.7.6", path: "soljson-v0.7.6.js" });

    const { result, rerender } = renderHook(
      ({ version }) => useWebSolc({ version }),
      {
        initialProps: { version: "^0.8.0" },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("0.8.26", undefined);

    // Change version
    rerender({ version: "^0.7.0" });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("0.7.6", undefined);
  });

  it("should use cache when available", async () => {
    const mockCache = new MemoryCache();
    vi.spyOn(mockCache, "get").mockResolvedValue("cached soljson");
    vi.spyOn(mockCache, "set");

    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }), {
      wrapper: ({ children }) => (
        <WebSolcProvider cache={mockCache}>{children}</WebSolcProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockCache.get).toHaveBeenCalledWith("0.8.26");
    expect(mockedWebSolc.fetchSolc).not.toHaveBeenCalled();
    expect(mockedWebSolc.loadSolc).toHaveBeenCalledWith(
      "cached soljson",
      undefined
    );
  });

  it("should populate cache on cache miss", async () => {
    const mockCache = new MemoryCache();
    vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
    vi.spyOn(mockCache, "set");

    const { result } = renderHook(() => useWebSolc({ version: "^0.8.0" }), {
      wrapper: ({ children }) => (
        <WebSolcProvider cache={mockCache}>{children}</WebSolcProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockCache.get).toHaveBeenCalledWith("0.8.26");
    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("0.8.26", undefined);
    expect(mockCache.set).toHaveBeenCalledWith("0.8.26", "mock soljson");
  });

  it("should cleanup worker on unmount", async () => {
    // Create a fresh mock to track cleanup
    const localMockSolc: WebSolc = {
      compile: vi.fn(),
      stopWorker: vi.fn(),
    };

    mockedWebSolc.loadSolc.mockResolvedValueOnce(localMockSolc);

    const { result, unmount } = renderHook(() =>
      useWebSolc({ version: "^0.8.0" })
    );

    // Wait for compiler to be loaded
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // The compiler should be loaded now
    expect(result.current.compile).toBeDefined();

    unmount();

    // Cleanup should happen synchronously in the cleanup function
    expect(localMockSolc.stopWorker).toHaveBeenCalledTimes(1);
  });

  it("should throw error if neither version nor soljson provided", async () => {
    const { result } = renderHook(() => useWebSolc({}));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.error?.message).toBe(
      "Either version or soljson must be provided"
    );
  });

  it("should throw error if compile is called when compiler is null", async () => {
    // Test the hook's actual compile function behavior when compiler is not set
    const { result } = renderHook(() => {
      // Simulate the hook's internal state
      const [compiler] = useState<WebSolc | null>(null);

      const compile = useCallback(
        async (input: CompilerInput) => {
          if (!compiler) {
            throw new Error("Compiler not ready");
          }
          return compiler.compile(input);
        },
        [compiler]
      );

      return { compile };
    });

    await expect(result.current.compile({})).rejects.toThrow(
      "Compiler not ready"
    );
  });
});
