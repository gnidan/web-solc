import { fetchLatestReleasedSoljsonSatisfyingVersionRange } from "./common.js";

import type {
  FetchAndLoadOptions,
  WebSolc,
  LoadOptions,
  FetchSolcOptions,
} from "./interface.js";
import solcWorker from "./solc.worker.js";

export * from "./interface.js";

export async function fetchAndLoadSolc(
  versionRange: string,
  options?: FetchAndLoadOptions
): Promise<WebSolc> {
  const soljsonText = await fetchLatestReleasedSoljsonSatisfyingVersionRange(
    versionRange,
    options?.fetch
  );

  return loadSolc(soljsonText, options?.load);
}

/** @deprecated Use fetchAndLoadSolc instead */
export async function fetchSolc(
  versionRange: string,
  options?: FetchSolcOptions
): Promise<WebSolc> {
  return fetchAndLoadSolc(versionRange, { fetch: options });
}

export function loadSolc(soljsonText: string, options?: LoadOptions): WebSolc {
  const { worker, stopWorker } = startWorker();

  // Create a blob URL for the soljson
  const soljsonBlob = new Blob([soljsonText], {
    type: "application/javascript",
  });
  const soljsonUrl = URL.createObjectURL(soljsonBlob);

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

        worker.postMessage({
          soljsonUrl,
          input,
          disabledInterfaces:
            options?.compatibility?.disableLegacyInterfaceAdapters || [],
        });
      });
    },

    stopWorker: () => {
      stopWorker();
      URL.revokeObjectURL(soljsonUrl);
    },
  };
}

function startWorker(): {
  worker: Worker;
  stopWorker: () => void;
} {
  const workerBlob = new Blob([`(${solcWorker.toString()})()`], {
    type: "application/javascript",
  });
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  return {
    worker,
    stopWorker: () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    },
  };
}
