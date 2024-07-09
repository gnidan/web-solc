import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  fetchSolc,
  type WebSolc,
  type FetchSolcOptions,
  type CompilerInput,
  type CompilerOutput
} from "web-solc";

export interface WebSolcProviderProps extends FetchSolcOptions {
}

/**
 * This component manages a collection of Solidity compiler instances and
 * provides access to the `useWebSolc()` hook to children components.
 *
 * Since web-solc uses Web Workers, this component handles the cleanup of
 * all the web workers on unmount.
 */
export function WebSolcProvider({
  children,
  ...options
}: React.PropsWithChildren<WebSolcProviderProps>): JSX.Element {
  // State to store compiler instances
  const [solcs, setSolcs] = useState<{
    [versionRange: string]: WebSolc
  }>({});

  // Cleanup effect to stop all workers when the provider unmounts
  useEffect(() => {
    return () => {
      for (const solc of Object.values(solcs)) {
        solc.stopWorker();
      }
    };
  }, [solcs]);

  // Memoized function to get or create a compiler instance
  const contextValue = useMemo(() => (
    async (versionRange: string) => {
      if (versionRange in solcs) {
        return solcs[versionRange];
      }

      const solc = await fetchSolc(versionRange, options);
      setSolcs(previous => ({ ...previous, [versionRange]: solc }));
      return solc;
    }
  ), [solcs, options]);

  return <WebSolcContext.Provider value={contextValue}>
    {children}
  </WebSolcContext.Provider>;
}

/**
 * Custom hook to use the Solidity compiler
 * @param versionRange - The version range of the Solidity compiler to use
 * @returns An object with a compile function, or undefined if the compiler is not ready
 */
export function useWebSolc(
  versionRange: string
): Omit<WebSolc, "stopWorker"> | undefined {
  const getSolc = useContext(WebSolcContext);
  if (!getSolc) {
    throw new Error("useWebSolc() must be used inside a <WebSolcProvider>");
  }

  const [solc, setSolc] = useState<WebSolc | null>(null);

  // Effect to fetch and set the compiler instance
  useEffect(() => {
    let isMounted = true;

    getSolc(versionRange).then(solc => {
      if (isMounted) {
        setSolc(solc);
      }
    });

    return () => {
      isMounted = false;
    }
  }, [getSolc, versionRange]);

  // Memoized compile function
  const compile = useCallback(
    async (input: CompilerInput): Promise<CompilerOutput> => {
      if (!solc) {
        throw new Error("Compiler not ready");
      }
      return solc.compile(input);
    },
    [solc]
  );

  // Return the compile function if the compiler is ready, otherwise undefined
  return solc
    ? { compile }
    : undefined;
}

// Type for the getSolc function
type GetSolc = (versionRange: string) => Promise<WebSolc>;

// Create context with null as default value
const WebSolcContext = createContext<GetSolc | null>(null);
