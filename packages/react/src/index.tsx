import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fetchSolc,
  loadSolc,
  resolveSolc,
  type WebSolc,
  type FetchOptions,
  type LoadOptions,
  type CompilerInput,
  type CompilerOutput,
} from "web-solc";

// Cache interface for pluggable caching strategies - stores soljson strings
export interface SoljsonCache {
  get(version: string): Promise<string | undefined>;
  set(version: string, soljson: string): Promise<void>;
  clear(): Promise<void>;
}

// Default in-memory cache implementation
export class MemoryCache implements SoljsonCache {
  private cache = new Map<string, string>();

  async get(version: string): Promise<string | undefined> {
    return this.cache.get(version);
  }

  async set(version: string, soljson: string): Promise<void> {
    this.cache.set(version, soljson);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// Context type
interface WebSolcContextValue {
  cache: SoljsonCache;
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
}

const WebSolcContext = createContext<WebSolcContextValue | null>(null);

// Provider props
export interface WebSolcProviderProps {
  cache?: SoljsonCache;
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
}

/**
 * Optional provider for managing soljson caching.
 * If not used, useWebSolc will work without caching.
 */
export function WebSolcProvider({
  children,
  cache = new MemoryCache(),
  fetchOptions,
  loadOptions,
}: React.PropsWithChildren<WebSolcProviderProps>): JSX.Element {
  const contextValue = useMemo(
    () => ({
      cache,
      fetchOptions,
      loadOptions,
    }),
    [cache, fetchOptions, loadOptions]
  );

  return (
    <WebSolcContext.Provider value={contextValue}>
      {children}
    </WebSolcContext.Provider>
  );
}

// Hook options
export interface UseWebSolcOptions {
  version?: string; // Version range (will be resolved to exact version)
  soljson?: string; // Direct soljson string
  fetchOptions?: FetchOptions;
  loadOptions?: LoadOptions;
}

// Hook result
export type UseWebSolcResult =
  | { loading: true; error?: never; compile?: never }
  | { loading: false; error: Error; compile?: never }
  | {
      loading: false;
      error?: never;
      compile: (input: CompilerInput) => Promise<CompilerOutput>;
    };

/**
 * Hook to use Solidity compiler. Works with or without WebSolcProvider.
 */
export function useWebSolc(options: UseWebSolcOptions): UseWebSolcResult {
  const context = useContext(WebSolcContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [compiler, setCompiler] = useState<WebSolc | null>(null);

  // Track compiler for cleanup
  const compilerRef = useRef<WebSolc | null>(null);

  // Stable options ref
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let cancelled = false;
    let localCompiler: WebSolc | null = null;

    async function loadCompiler() {
      const currentOptions = optionsRef.current;

      try {
        setLoading(true);
        setError(null);

        let soljson: string;

        if (currentOptions.soljson) {
          // Direct soljson provided
          soljson = currentOptions.soljson;
        } else if (currentOptions.version) {
          // Resolve version range to exact version
          const { version: exactVersion } = await resolveSolc(
            currentOptions.version,
            currentOptions.fetchOptions ?? context?.fetchOptions
          );

          if (cancelled) return;

          // Try cache first if available
          if (context?.cache) {
            const cached = await context.cache.get(exactVersion);
            if (cached) {
              soljson = cached;
            } else {
              // Not in cache, fetch it
              soljson = await fetchSolc(
                exactVersion,
                currentOptions.fetchOptions ?? context?.fetchOptions
              );

              if (cancelled) return;

              // Store in cache for next time
              await context.cache.set(exactVersion, soljson);
            }
          } else {
            // No cache, just fetch
            soljson = await fetchSolc(
              exactVersion,
              currentOptions.fetchOptions ?? context?.fetchOptions
            );
          }

          if (cancelled) return;
        } else {
          throw new Error("Either version or soljson must be provided");
        }

        // Load the compiler from soljson
        localCompiler = await loadSolc(
          soljson,
          currentOptions.loadOptions ?? context?.loadOptions
        );

        if (cancelled) {
          localCompiler.stopWorker();
          return;
        }

        setCompiler(localCompiler);
        compilerRef.current = localCompiler;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
          setCompiler(null);
          compilerRef.current = null;
        }
        // Clean up local compiler if error occurred
        if (localCompiler) {
          localCompiler.stopWorker();
        }
      }
    }

    loadCompiler();

    return () => {
      cancelled = true;

      // Always clean up our compiler instance
      if (compilerRef.current) {
        compilerRef.current.stopWorker();
        compilerRef.current = null;
      }
    };
  }, [
    options.version,
    options.soljson,
    options.fetchOptions,
    options.loadOptions,
    context,
  ]);

  // Memoized compile function
  const compile = useCallback(
    async (input: CompilerInput): Promise<CompilerOutput> => {
      if (!compiler) {
        throw new Error("Compiler not ready");
      }
      return compiler.compile(input);
    },
    [compiler]
  );

  // Return appropriate result
  if (loading) {
    return { loading: true };
  }

  if (error) {
    return { loading: false, error };
  }

  return { loading: false, compile };
}

// Re-export types from web-solc for convenience
export type {
  WebSolc,
  CompilerInput,
  CompilerOutput,
  FetchOptions,
  LoadOptions,
} from "web-solc";
