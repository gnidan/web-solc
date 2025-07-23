import { fetchSolc } from "./common.js";

import type { FetchAndLoadOptions, WebSolc, LoadOptions } from "./interface.js";
import solcWorker from "./solc.worker.js";

export * from "./interface.js";

export { fetchSolc, resolveSolc } from "./common.js";

export async function fetchAndLoadSolc(
  versionRange: string,
  options?: FetchAndLoadOptions
): Promise<WebSolc> {
  const soljson = options?.fetch
    ? await fetchSolc(versionRange, options.fetch)
    : await fetchSolc(versionRange);
  return loadSolc(soljson, options?.load);
}

export async function loadSolc(
  soljson: string,
  options?: LoadOptions
): Promise<WebSolc> {
  const { worker, stopWorker } = startWorker();

  // Create a blob URL for the soljson
  const soljsonBlob = new Blob([soljson], {
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
            options?.compatibility?.disableCompilerInterfaces || [],
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
