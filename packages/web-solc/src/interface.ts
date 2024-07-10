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
  errors?: any[];
  sources: any[];
  contracts: any[];
}
