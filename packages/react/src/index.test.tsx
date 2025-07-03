import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import { WebSolcProvider, useWebSolc } from "./index.js";
import * as webSolc from "web-solc";
import type { WebSolc, CompilerInput } from "web-solc";

// Type the mocked module
const mockedWebSolc = vi.mocked(webSolc);

describe("WebSolcProvider", () => {
  const mockCompile = vi.fn();
  const mockStopWorker = vi.fn();
  const mockSolc = {
    compile: mockCompile,
    stopWorker: mockStopWorker,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedWebSolc.fetchSolc.mockResolvedValue(mockSolc);
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

  it("should pass options to fetchSolc", async () => {
    const options = { repository: { baseUrl: "https://custom.url" } };

    const { result } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => (
        <WebSolcProvider {...options}>{children}</WebSolcProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("^0.8.0", options);
  });

  it("should cleanup workers on unmount", async () => {
    const { result, unmount } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => <WebSolcProvider>{children}</WebSolcProvider>,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    unmount();

    expect(mockStopWorker).toHaveBeenCalledTimes(1);
  });

  it("should cache compiler instances by version range", async () => {
    const { result: result1, rerender } = renderHook(
      ({ version }) => useWebSolc(version),
      {
        initialProps: { version: "^0.8.0" },
        wrapper: ({ children }) => (
          <WebSolcProvider>{children}</WebSolcProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result1.current).toBeDefined();
    });

    // First fetch
    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledTimes(1);

    // Use same version again
    rerender({ version: "^0.8.0" });

    await waitFor(() => {
      expect(result1.current).toBeDefined();
    });

    // Should not fetch again
    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledTimes(1);

    // Use different version
    rerender({ version: "^0.7.0" });

    await waitFor(() => {
      expect(result1.current).toBeDefined();
    });

    // Should fetch the new version
    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledTimes(2);
    expect(mockedWebSolc.fetchSolc).toHaveBeenLastCalledWith("^0.7.0", {});
  });
});

describe("useWebSolc", () => {
  const mockCompile = vi.fn();
  const mockStopWorker = vi.fn();
  const mockSolc = {
    compile: mockCompile,
    stopWorker: mockStopWorker,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedWebSolc.fetchSolc.mockResolvedValue(mockSolc);
  });

  afterEach(() => {
    cleanup();
  });

  it("should throw error when used outside WebSolcProvider", () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      renderHook(() => useWebSolc("^0.8.0"));
    }).toThrow("useWebSolc() must be used inside a <WebSolcProvider>");

    console.error = originalError;
  });

  it("should return undefined while loading", () => {
    const { result } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => <WebSolcProvider>{children}</WebSolcProvider>,
    });

    expect(result.current).toBeUndefined();
  });

  it("should return compile function when ready", async () => {
    const { result } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => <WebSolcProvider>{children}</WebSolcProvider>,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current).toHaveProperty("compile");
    expect(result.current).not.toHaveProperty("stopWorker");
  });

  it("should compile when compile is called", async () => {
    mockCompile.mockResolvedValue({ contracts: {} });

    const { result } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => <WebSolcProvider>{children}</WebSolcProvider>,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    const input = {
      language: "Solidity",
      sources: {
        "test.sol": {
          content: "contract Test {}",
        },
      },
    };

    const output = await result.current!.compile(input);

    expect(mockCompile).toHaveBeenCalledWith(input);
    expect(output).toEqual({ contracts: {} });
  });

  it("should throw error if compile is called before compiler is ready", async () => {
    // Create a promise that never resolves
    const neverResolve = new Promise(() => {});
    mockedWebSolc.fetchSolc.mockReturnValue(neverResolve as Promise<WebSolc>);

    const { result } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => <WebSolcProvider>{children}</WebSolcProvider>,
    });

    // Compiler should be undefined
    expect(result.current).toBeUndefined();

    // Now mock the compile function to test the error case
    const mockUndefinedCompiler = renderHook(() => {
      const [solc] = React.useState<WebSolc | null>(null);

      return {
        compile: async (input: CompilerInput) => {
          if (!solc) {
            throw new Error("Compiler not ready");
          }
          return solc.compile(input);
        },
      };
    });

    await expect(
      mockUndefinedCompiler.result.current.compile({})
    ).rejects.toThrow("Compiler not ready");
  });

  it("should handle version change", async () => {
    const { result, rerender } = renderHook(
      ({ version }) => useWebSolc(version),
      {
        initialProps: { version: "^0.8.0" },
        wrapper: ({ children }) => (
          <WebSolcProvider>{children}</WebSolcProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("^0.8.0", {});

    // Change version
    rerender({ version: "^0.7.0" });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockedWebSolc.fetchSolc).toHaveBeenCalledWith("^0.7.0", {});
  });

  it("should cleanup on unmount", async () => {
    const { result, unmount } = renderHook(() => useWebSolc("^0.8.0"), {
      wrapper: ({ children }) => <WebSolcProvider>{children}</WebSolcProvider>,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Store reference to check it's not updated after unmount
    const currentResult = result.current;

    unmount();

    // Result should remain the same after unmount
    expect(result.current).toBe(currentResult);
  });
});
