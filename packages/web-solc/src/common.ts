import semver from "semver";

import {
  defaultBaseUrl,
  defaultBuild,
  type FetchOptions,
} from "./interface.js";

export async function resolveSolc(
  versionRange: string,
  options: FetchOptions = {}
): Promise<{ version: string; path: string }> {
  const { builds } = await fetchBinList(options);
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
  const { path } = await resolveSolc(versionRange, options);
  const soljson = await fetchSoljson(path, options);

  return soljson;
}

interface BinList {
  builds: {
    path: string;
    longVersion: string;
    /* ... other fields are not used */
  }[];
}

function buildsUrl(options: FetchOptions = {}): string {
  const {
    build = defaultBuild,
    repository: { baseUrl = defaultBaseUrl } = {},
  } = options;

  const path = build === "wasm" ? "wasm" : "bin";

  return `${baseUrl}/${path}`;
}

async function fetchBinList(options: FetchOptions = {}): Promise<BinList> {
  const response = await fetch(`${buildsUrl(options)}/list.json`);

  return response.json();
}

async function fetchSoljson(
  path: string,
  options: FetchOptions = {}
): Promise<string> {
  const response = await fetch(`${buildsUrl(options)}/${path}`);

  return response.text();
}
