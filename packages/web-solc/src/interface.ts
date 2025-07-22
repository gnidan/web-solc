export interface RepositoryOptions {
  baseUrl?: string;
}

export const defaultBaseUrl = "https://binaries.soliditylang.org/bin";

// Options for fetching/downloading Solidity compiler
export interface FetchOptions {
  repository?: RepositoryOptions;
}

// Constants for the different compiler interfaces
export const legacyInterfaces = {
  compileJson: "compile-json", // Oldest single-file API
  compileJsonMulti: "compile-json-multi", // Legacy multi-file API
  compileStandard: "compile-standard", // Standard JSON API (0.4.11+)
  solidityCompile: "solidity-compile", // Modern API (0.5.0+)
} as const;

export type LegacyInterface =
  (typeof legacyInterfaces)[keyof typeof legacyInterfaces];

// Options for loading/configuring Solidity compiler
export interface LoadOptions {
  compatibility?: {
    // Disable the getCFunc underscore prefix fix for 0.4.x versions
    disableUnderscorePatching?: boolean;

    // Disable specific compiler interface adapters
    // By default, all interfaces are tried in order of preference
    // Pass an array of interfaces to disable
    disableLegacyInterfaceAdapters?: LegacyInterface[];
  };
}

// Combined options for fetchAndLoadSolc
export interface FetchAndLoadOptions {
  fetch?: FetchOptions;
  load?: LoadOptions;
}

// Legacy aliases for backward compatibility
/** @deprecated Use FetchOptions instead */
export type FetchSolcOptions = FetchOptions;
/** @deprecated Use LoadOptions instead */
export type LoadSolcOptions = LoadOptions;

export interface WebSolc {
  compile(input: CompilerInput): Promise<CompilerOutput>;
  stopWorker(): void;
}

export type CompilerInput = object;
export interface CompilerOutput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sources: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contracts: any[];
}
