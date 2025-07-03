export interface FetchSolcOptions {
  repository?: RepositoryOptions;
}

export interface RepositoryOptions {
  baseUrl?: string;
}

export const defaultBaseUrl = "https://binaries.soliditylang.org/bin";

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
