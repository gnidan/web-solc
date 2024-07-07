import semver from "semver";

export interface RepositoryOptions {
  baseUrl?: string;
}

export const defaultBaseUrl = "https://binaries.soliditylang.org/bin";

export interface WebSolc {
  compile(input: CompilerInput): Promise<CompilerOutput>;
  stopWorker(): void;
}

export type CompilerInput = object;
export type CompilerOutput = any;

export async function fetchLatestReleasedSoljsonSatisfyingVersionRange(
  versionRange: string,
  options?: RepositoryOptions
): Promise<string> {
  const { builds } = await fetchBinList(options);
  const compatibleBuilds = builds
    .filter(({ longVersion }) => semver.satisfies(longVersion, versionRange));

  const latestCompatibleBuild = compatibleBuilds.at(-1);

  if (!latestCompatibleBuild) {
    throw new Error(`Could not find solc version to satisfy requested range ${
      versionRange
    }`);
  }

  const soljsonText = await fetchSoljson(latestCompatibleBuild.path, options);

  return soljsonText;
}

interface BinList {
  builds: {
    path: string;
    longVersion: string;
    /* ... other fields are not used */
  }[];
}

async function fetchBinList({
  baseUrl = defaultBaseUrl
}: RepositoryOptions = {}): Promise<BinList> {
  const response = await fetch(`${baseUrl}/list.json`);

  return response.json();
}

async function fetchSoljson(
  path: string,
  { baseUrl = defaultBaseUrl }: RepositoryOptions = {}
): Promise<string> {
  const response = await fetch(`${baseUrl}/${path}`);

  return response.text();
}
