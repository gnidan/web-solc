import semver from "semver";

import {
  defaultBaseUrl,
  type FetchOptions,
  type RepositoryOptions,
} from "./interface.js";

export async function resolveSolc(
  versionRange: string,
  options: FetchOptions = {}
): Promise<{ version: string; path: string }> {
  const { repository = {} } = options;
  const { builds } = await fetchBinList(repository);
  const compatibleBuilds = builds.filter(({ longVersion }) =>
    semver.satisfies(longVersion, versionRange)
  );

  const latestCompatibleBuild = compatibleBuilds.at(-1);

  if (!latestCompatibleBuild) {
    throw new Error(
      `Could not find solc version to satisfy requested range ${versionRange}`
    );
  }

  // Extract just the version number from longVersion (e.g., "0.8.26+commit.abc123" -> "0.8.26")
  const version = latestCompatibleBuild.longVersion.split("+")[0];

  return {
    version,
    path: latestCompatibleBuild.path,
  };
}

export async function fetchSolc(
  versionRange: string,
  options: FetchOptions = {}
): Promise<string> {
  const { repository = {} } = options;
  const { path } = await resolveSolc(versionRange, options);
  const soljson = await fetchSoljson(path, repository);

  return soljson;
}

interface BinList {
  builds: {
    path: string;
    longVersion: string;
    /* ... other fields are not used */
  }[];
}

async function fetchBinList({
  baseUrl = defaultBaseUrl,
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
