import semver from "semver";

import type { CompilerInput, CompilerOutput } from "./types";
import solcWorker from "./solc.worker";

export interface RepositoryOptions {
  baseUrl?: string;
}

export const defaultBaseUrl = "https://binaries.soliditylang.org/bin";

export interface WebSolc {
  compile(input: CompilerInput): Promise<CompilerOutput>;
  stopWorker(): void;
}

export default async function webSolc(
  versionRange: string,
  options?: RepositoryOptions
): Promise<WebSolc> {
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

  const { worker, stopWorker } = startWorker();

  return {
    compile(input) {
      return new Promise((accept, reject) => {
        worker.onmessage = (event) => {
          try {
            accept(event.data);
          } catch (error) {
            reject(error);
          }
        };

        worker.onerror = reject;

        worker.postMessage({ soljsonText, input });
      });
    },

    stopWorker
  }
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
  {
    baseUrl = defaultBaseUrl
  }: RepositoryOptions = {}
): Promise<string> {
  const response = await fetch(`${baseUrl}/${path}`);

  return response.text();
}

function startWorker(): {
  worker: Worker;
  stopWorker: () => void;
} {
  const workerBlob = new Blob(
    [`(${solcWorker.toString()})()`],
    { type: "application/javascript" }
  );
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  return {
    worker,
    stopWorker: () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    }
  };
}
