import semver from "semver";

import {
  defaultBaseUrl,
  type FetchSolcOptions,
  type RepositoryOptions,
} from "./interface.js";

export async function fetchLatestReleasedSoljsonSatisfyingVersionRange(
  versionRange: string,
  { repository = {} }: FetchSolcOptions = {}
): Promise<string> {
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

  const soljsonText = await fetchSoljson(
    latestCompatibleBuild.path,
    repository
  );

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
